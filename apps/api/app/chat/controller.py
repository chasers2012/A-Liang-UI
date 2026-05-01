"""Chat module controller: orchestrates LLM/chat-session business logic."""

from __future__ import annotations

import asyncio
import json
import threading
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import suppress
from typing import Any

from diskcache import Cache
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.types import Command
from workspace import workspace_path

from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator
from app.llm import build_chat_model

from .agent import (
    stream_event_aiter_for_chat,
)
from .events import (
    DeltaEvent,
    DoneEvent,
    ErrorEvent,
    MessageIdsEvent,
    MessageIdsPayload,
    ReasoningEvent,
    StreamEventAny,
    ToolEvent,
    ToolPayload,
)
from .registry import ChatRegistry
from .schemas import (
    AssistantBlockPublic,
    ChatArchivedSummaryPublic,
    ChatAuthorizationRequest,
    ChatBatchDeleteBody,
    ChatBatchDeleteResult,
    ChatBatchUpdateBody,
    ChatBatchUpdateResult,
    ChatCreateBody,
    ChatDetailPublic,
    ChatMessageIn,
    ChatRecord,
    ChatRenameBody,
    ChatRequest,
    ChatStopRequest,
    ChatSummaryPublic,
    ChatToolCallPublic,
    ensure_chat_message_id,
    message_text_for_model,
)

MAX_SESSION_MESSAGES = 200
_CHAT_ID_GENERATOR = create_id_generator("ChatRegistry")
_AUTH_PENDING_TTL_SECONDS = 10 * 60
_AUTH_WAIT_POLL_SECONDS = 0.2
_AUTH_CACHE = Cache(str(workspace_path(".quant-agent/chat_auth_cache")))
_RUNNING_STREAMS_LOCK = threading.Lock()
_RUNNING_STREAMS: dict[str, dict[str, Any]] = {}


def _register_running_stream(
    *,
    thread_id: str,
    session_id: str,
    assistant_message_id: str,
    task: asyncio.Task[Any],
) -> None:
    with _RUNNING_STREAMS_LOCK:
        _RUNNING_STREAMS[thread_id] = {
            "session_id": session_id,
            "assistant_message_id": assistant_message_id,
            "task": task,
            "loop": task.get_loop(),
            "started_at": time.monotonic(),
        }


def _unregister_running_stream(thread_id: str) -> None:
    with _RUNNING_STREAMS_LOCK:
        _RUNNING_STREAMS.pop(thread_id, None)


def _resolve_stop_target_thread_id(body: ChatStopRequest) -> str | None:
    with _RUNNING_STREAMS_LOCK:
        candidates = [
            (thread_id, meta)
            for thread_id, meta in _RUNNING_STREAMS.items()
            if meta.get("session_id") == body.session_id
        ]
    if not candidates:
        return None
    if body.assistant_message_id:
        for thread_id, meta in candidates:
            if meta.get("assistant_message_id") == body.assistant_message_id:
                return thread_id
        return None
    # Fallback to the latest running stream in this session.
    candidates.sort(key=lambda item: float(item[1].get("started_at", 0.0)), reverse=True)
    return candidates[0][0]


def record_to_summary(rec: ChatRecord) -> ChatSummaryPublic:
    return ChatSummaryPublic(
        id=rec.id,
        title=rec.title,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        message_count=rec.message_count,
    )


def record_to_archived_summary(rec: ChatRecord) -> ChatArchivedSummaryPublic:
    if not rec.archived_at:
        raise ValueError("chat is not archived")
    return ChatArchivedSummaryPublic(
        **record_to_summary(rec).model_dump(),
        archived_at=rec.archived_at,
    )


def record_to_detail(rec: ChatRecord) -> ChatDetailPublic:
    messages = ChatRegistry.get_messages(rec.id) or []
    return ChatDetailPublic(
        id=rec.id,
        title=rec.title,
        messages=messages,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _auth_pending_key(thread_id: str) -> str:
    return f"chat_auth:pending:{thread_id}"


def _auth_decision_key(thread_id: str) -> str:
    return f"chat_auth:decision:{thread_id}"


def _register_pending_auth(
    *,
    thread_id: str,
    session_id: str,
    assistant_message_id: str,
) -> None:
    _AUTH_CACHE.set(
        _auth_pending_key(thread_id),
        {
            "session_id": session_id,
            "assistant_message_id": assistant_message_id,
        },
        expire=_AUTH_PENDING_TTL_SECONDS,
    )
    _AUTH_CACHE.delete(_auth_decision_key(thread_id))


def _clear_pending_auth(thread_id: str) -> None:
    _AUTH_CACHE.delete(_auth_pending_key(thread_id))
    _AUTH_CACHE.delete(_auth_decision_key(thread_id))


def _append_delta_block(
    blocks: list[AssistantBlockPublic],
    delta: str,
    *,
    run_segment_id: str | None = None,
) -> None:
    if not blocks:
        blocks.append(
            AssistantBlockPublic(
                kind="text",
                content=delta,
                run_segment_id=run_segment_id,
            )
        )
        return
    last = blocks[-1]
    if last.kind == "text" and last.run_segment_id == run_segment_id:
        last.content = (last.content or "") + delta
    else:
        blocks.append(
            AssistantBlockPublic(
                kind="text",
                content=delta,
                run_segment_id=run_segment_id,
            )
        )


def _append_reasoning_block(
    blocks: list[AssistantBlockPublic],
    delta: str,
    *,
    run_segment_id: str | None = None,
) -> None:
    if not blocks:
        blocks.append(
            AssistantBlockPublic(
                kind="reasoning",
                content=delta,
                run_segment_id=run_segment_id,
            )
        )
        return
    last = blocks[-1]
    if last.kind == "reasoning" and last.run_segment_id == run_segment_id:
        last.content = (last.content or "") + delta
    else:
        blocks.append(
            AssistantBlockPublic(
                kind="reasoning",
                content=delta,
                run_segment_id=run_segment_id,
            )
        )


def _patch_tool_block(
    blocks: list[AssistantBlockPublic],
    tc_id: str,
    *,
    ok: bool,
    result: Any,
    error: str | None,
) -> None:
    for b in reversed(blocks):
        if b.kind != "tool" or b.call is None or b.call.id != tc_id:
            continue
        if ok:
            b.call.status = "ok"
            b.call.result = result
            b.call.error = None
        else:
            b.call.status = "error"
            b.call.error = error or ""
            b.call.result = None
        return


def _append_tool_start_block(
    blocks: list[AssistantBlockPublic],
    tool_payload: ToolPayload,
) -> None:
    blocks.append(
        AssistantBlockPublic(
            kind="tool",
            run_segment_id=tool_payload.run_segment_id,
            call=ChatToolCallPublic(
                id=tool_payload.id,
                name=tool_payload.name,
                args=tool_payload.args,
                status="running",
            ),
        )
    )


def _patch_tool_terminal_event(
    blocks: list[AssistantBlockPublic],
    tool_payload: ToolPayload,
    *,
    ok: bool,
) -> None:
    _patch_tool_block(
        blocks,
        tool_payload.id,
        ok=ok,
        result=(tool_payload.result if ok else None),
        error=(None if ok else tool_payload.error or ""),
    )


def _mark_tool_authorization_pending(
    blocks: list[AssistantBlockPublic],
    tc_id: str,
) -> None:
    if not tc_id:
        return
    for b in reversed(blocks):
        if b.kind != "tool" or b.call is None or b.call.id != tc_id:
            continue
        b.call.authorization_status = "pending"
        return


def _apply_authorization_decisions_to_blocks(
    blocks: list[AssistantBlockPublic],
    decisions: list[dict[str, Any]],
) -> None:
    for decision in decisions:
        tc_id = str(decision.get("tool_call_id", "")).strip()
        if not tc_id:
            continue
        decision_type = str(decision.get("type", "")).strip().lower()
        auth_status = "approved" if decision_type == "approve" else "rejected"
        for b in reversed(blocks):
            if b.kind != "tool" or b.call is None or b.call.id != tc_id:
                continue
            b.call.authorization_status = auth_status
            break


def _apply_stream_event_to_blocks(
    blocks: list[AssistantBlockPublic],
    event: StreamEventAny,
) -> None:
    if isinstance(event, (ErrorEvent, MessageIdsEvent, DoneEvent)):
        return
    if isinstance(event, DeltaEvent):
        _append_delta_block(
            blocks,
            event.payload.text,
            run_segment_id=event.payload.run_segment_id,
        )
        return

    if isinstance(event, ReasoningEvent):
        _append_reasoning_block(
            blocks,
            event.payload.text,
            run_segment_id=event.payload.run_segment_id,
        )
        return

    if isinstance(event, ToolEvent):
        tool = event.payload
        if tool.stage == "start":
            _append_tool_start_block(blocks, tool)
        elif tool.stage == "result":
            _patch_tool_terminal_event(blocks, tool, ok=True)
        elif tool.stage == "error":
            _patch_tool_terminal_event(blocks, tool, ok=False)
        elif tool.stage == "authorize":
            _mark_tool_authorization_pending(blocks, tool.id)
            return


def _sse_wire_frame(ev: StreamEventAny) -> str:
    """One SSE message: ``event:`` = ``ev.type``; ``data:`` = JSON payload only (no ``type`` key)."""
    dumped = ev.model_dump(mode="json", exclude_none=True)
    data_body = json.dumps(dumped.get("payload"), ensure_ascii=False)
    lines = [f"event: {ev.type}"]
    for segment in data_body.split("\n"):
        lines.append(f"data: {segment}")
    lines.append("")
    return "\n".join(lines) + "\n"


def _persist_chat_if_needed(
    session_id: str,
    messages: list[ChatMessageIn],
    blocks: list[AssistantBlockPublic],
    assistant_message_id: str,
) -> None:
    session = get_active_chat(session_id)
    if session is None:
        return

    final_messages = list(messages)
    if blocks:
        final_messages.append(
            ChatMessageIn(
                id=assistant_message_id,
                role="assistant",
                blocks=blocks,
            )
        )
    try:
        replace_session_messages(session_id, final_messages)
    except ValueError:
        return


def _build_chat_context_messages(
    session_id: str,
    incoming_user: ChatMessageIn,
    *,
    replace_from_message_id: str | None = None,
) -> tuple[list[ChatMessageIn], list[ChatMessageIn]]:
    history_messages = ChatRegistry.get_messages(session_id) or []
    if replace_from_message_id:
        replace_index = next(
            (
                idx
                for idx, message in enumerate(history_messages)
                if message.id == replace_from_message_id and message.role == "user"
            ),
            None,
        )
        if replace_index is None:
            raise ValueError("replace_from_message_id 对应的 user 消息不存在")
        history_messages = history_messages[:replace_index]
    persisted_context_messages = [*history_messages, incoming_user]
    context_messages = list(persisted_context_messages)
    return persisted_context_messages, context_messages


def _prepare_chat_stream(
    body: ChatRequest,
) -> tuple[str, ChatMessageIn, list[ChatMessageIn], list[ChatMessageIn]]:
    session = get_active_chat(body.session_id)
    if session is None:
        raise ValueError("会话不存在或已归档")

    incoming_user = ensure_chat_message_id(body.message)
    if not incoming_user.id:
        raise ValueError("user 消息 id 生成失败")

    persisted_context_messages, context_messages = _build_chat_context_messages(
        body.session_id,
        incoming_user,
        replace_from_message_id=body.replace_from_message_id,
    )
    return body.session_id, incoming_user, persisted_context_messages, context_messages


async def _wait_for_authorization_decision(
    *,
    thread_id: str,
    is_disconnected: Callable[[], Awaitable[bool]],
) -> dict[str, Any] | None:
    decision_key = _auth_decision_key(thread_id)
    while True:
        if await is_disconnected():
            return None
        decision = _AUTH_CACHE.get(decision_key, default=None)
        if isinstance(decision, dict):
            _AUTH_CACHE.delete(decision_key)
            return decision
        await asyncio.sleep(_AUTH_WAIT_POLL_SECONDS)


def _lc_messages_from_chat_messages(messages: list[ChatMessageIn]) -> list[BaseMessage]:
    lc_messages: list[BaseMessage] = []
    for m in messages:
        text = message_text_for_model(m)
        if m.role == "system":
            lc_messages.append(SystemMessage(content=text))
        elif m.role == "user":
            lc_messages.append(HumanMessage(content=text))
        else:
            lc_messages.append(AIMessage(content=text))
    return lc_messages


async def stream_async(  # noqa: C901
    body: ChatRequest,
    *,
    is_disconnected: Callable[[], Awaitable[bool]],
) -> AsyncIterator[str]:
    # Request carries exactly one new user message; model context is built from
    # persisted history + this single incoming turn.
    session_id, incoming_user, persisted_context_messages, context_messages = _prepare_chat_stream(
        body
    )
    last_user_id = incoming_user.id
    assistant_message_id = str(uuid.uuid4())
    thread_id = f"{session_id}:{assistant_message_id}"
    blocks: list[AssistantBlockPublic] = []

    replace_session_messages(session_id, persisted_context_messages)
    out: asyncio.Queue[str | None] = asyncio.Queue()

    async def _producer() -> None:  # noqa: C901
        try:
            if await is_disconnected():
                return
            message_ids_event = MessageIdsEvent(
                payload=MessageIdsPayload(
                    user=last_user_id,
                    assistant=assistant_message_id,
                ),
            )
            if await is_disconnected():
                return
            await out.put(_sse_wire_frame(message_ids_event))
            llm = build_chat_model()
            pending_decision: dict[str, Any] | None = None

            while True:
                interrupted = False

                input: Any
                if pending_decision is not None:
                    if not isinstance(pending_decision.get("decisions"), list):
                        raise ValueError("授权续跑失败：缺少有效 decisions")
                    input = Command(resume={"decisions": pending_decision["decisions"]})
                else:
                    input = {"messages": _lc_messages_from_chat_messages(context_messages or [])}

                async for event in stream_event_aiter_for_chat(
                    llm, input, config={"configurable": {"thread_id": thread_id}}
                ):
                    if await is_disconnected():
                        return
                    _apply_stream_event_to_blocks(blocks, event)
                    is_authorize_event = (
                        isinstance(event, ToolEvent) and event.payload.stage == "authorize"
                    )
                    if is_authorize_event and not interrupted:
                        interrupted = True
                        # Register pending authorization before emitting first SSE authorize event,
                        # so fast clients cannot race /chat/authorize ahead of this context.
                        _register_pending_auth(
                            thread_id=thread_id,
                            session_id=session_id,
                            assistant_message_id=assistant_message_id,
                        )
                    if await is_disconnected():
                        return
                    await out.put(_sse_wire_frame(event))

                if interrupted:
                    try:
                        pending_decision = await _wait_for_authorization_decision(
                            thread_id=thread_id,
                            is_disconnected=is_disconnected,
                        )
                    finally:
                        _clear_pending_auth(thread_id)
                    if pending_decision is None:
                        return
                    _apply_authorization_decisions_to_blocks(
                        blocks,
                        pending_decision.get("decisions", []),
                    )
                    continue
                return

        except ValueError as e:
            if not await is_disconnected():
                err_event = ErrorEvent(payload=f"{e}")
                await out.put(_sse_wire_frame(err_event))
            return
        finally:
            try:
                _clear_pending_auth(thread_id)
                _persist_chat_if_needed(
                    session_id,
                    persisted_context_messages,
                    blocks,
                    assistant_message_id,
                )
            finally:
                await out.put(None)

    producer_task = asyncio.create_task(_producer())
    _register_running_stream(
        thread_id=thread_id,
        session_id=session_id,
        assistant_message_id=assistant_message_id,
        task=producer_task,
    )

    try:
        while True:
            if await is_disconnected():
                return
            try:
                ev = await asyncio.wait_for(out.get(), timeout=0.2)
            except asyncio.TimeoutError:
                continue
            if ev is None:
                return
            yield ev
    finally:
        _unregister_running_stream(thread_id)
        if not producer_task.done():
            producer_task.cancel()
            with suppress(asyncio.CancelledError):
                await producer_task


def stop_stream(body: ChatStopRequest) -> dict[str, Any]:
    thread_id = _resolve_stop_target_thread_id(body)
    if not thread_id:
        raise ValueError("未找到可停止的运行任务")
    with _RUNNING_STREAMS_LOCK:
        meta = _RUNNING_STREAMS.get(thread_id)
    if not meta:
        raise ValueError("运行任务已结束")

    task = meta.get("task")
    loop = meta.get("loop")
    if not isinstance(task, asyncio.Task) or not isinstance(loop, asyncio.AbstractEventLoop):
        raise ValueError("运行任务状态异常")

    if task.done():
        _unregister_running_stream(thread_id)
        return {"status": "stopped", "thread_id": thread_id}

    loop.call_soon_threadsafe(task.cancel)
    return {"status": "stopping", "thread_id": thread_id}


def list_chats() -> list[ChatSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is None]
    items.sort(key=lambda i: i.created_at, reverse=True)
    return [record_to_summary(i) for i in items]


def submit_authorization(
    body: ChatAuthorizationRequest,
) -> dict[str, Any]:
    thread_id = f"{body.session_id}:{body.assistant_message_id}"

    pending = _AUTH_CACHE.get(_auth_pending_key(thread_id), default=None)
    if not pending:
        raise ValueError("未找到待授权的运行上下文，可能已超时或已完成。")

    session_id = pending["session_id"]
    if session_id != body.session_id:
        raise ValueError("session_id 不匹配")
    if pending["assistant_message_id"] != body.assistant_message_id:
        raise ValueError("assistant_message_id 不匹配")

    _AUTH_CACHE.set(
        _auth_decision_key(thread_id),
        {
            "decisions": [d.model_dump(mode="json") for d in body.decisions],
        },
        expire=_AUTH_PENDING_TTL_SECONDS,
    )
    return {"status": "accepted"}


def list_archived_chats() -> list[ChatArchivedSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is not None]
    return [record_to_archived_summary(i) for i in items]


def create_chat(body: ChatCreateBody) -> ChatDetailPublic:
    now = utc_now_iso()
    sid = _CHAT_ID_GENERATOR()
    rec_obj = ChatRecord(
        id=sid,
        title=body.title.strip() or "新会话",
        message_file=ChatRegistry._message_filename(sid),
        message_count=0,
        created_at=now,
        updated_at=now,
    )
    ChatRegistry.add_item(rec_obj)
    return record_to_detail(rec_obj)


def get_chat(session_id: str) -> ChatDetailPublic | None:
    rec = get_active_chat(session_id)
    if rec is None:
        return None
    return record_to_detail(rec)


def rename_chat(session_id: str, body: ChatRenameBody) -> ChatDetailPublic | None:
    name = body.title.strip()
    if not name:
        raise ValueError("title 不能为空")

    def _apply(rec: ChatRecord) -> None:
        if rec.archived_at is not None:
            raise ValueError("会话已归档")
        rec.title = name
        rec.updated_at = utc_now_iso()

    rec = ChatRegistry.update_item(session_id, _apply)
    if rec is None:
        return None
    return record_to_detail(rec)


def delete_chat(session_id: str) -> bool:
    rec = ChatRegistry.get_item(session_id)
    if rec is None:
        return False
    if rec.archived_at is not None:
        return True

    def _apply(item: ChatRecord) -> None:
        now = utc_now_iso()
        item.archived_at = now
        item.updated_at = now

    rec = ChatRegistry.update_item(session_id, _apply)
    return rec is not None


def restore_chat(session_id: str) -> ChatDetailPublic | None:
    rec = ChatRegistry.get_item(session_id)
    if rec is None or rec.archived_at is None:
        return None

    def _apply(item: ChatRecord) -> None:
        item.archived_at = None
        item.updated_at = utc_now_iso()

    rec = ChatRegistry.update_item(session_id, _apply)
    if rec is None:
        return None
    return record_to_detail(rec)


def purge_archived_chat(session_id: str) -> bool:
    rec = ChatRegistry.get_item(session_id)
    if rec is None or rec.archived_at is None:
        return False
    rec = ChatRegistry.delete_item(session_id)
    return rec is not None


def batch_update_chats(body: ChatBatchUpdateBody) -> ChatBatchUpdateResult:
    success_ids: list[str] = []
    failed_ids: list[str] = []
    for session_id in body.session_ids:
        ok = False
        if body.action == "archive":
            ok = delete_chat(session_id)
        else:
            ok = restore_chat(session_id) is not None
        if ok:
            success_ids.append(session_id)
        else:
            failed_ids.append(session_id)
    return ChatBatchUpdateResult(
        action=body.action,
        success_ids=success_ids,
        failed_ids=failed_ids,
    )


def batch_delete_chats(body: ChatBatchDeleteBody) -> ChatBatchDeleteResult:
    success_ids: list[str] = []
    failed_ids: list[str] = []
    for session_id in body.session_ids:
        rec = ChatRegistry.get_item(session_id)
        if rec is None:
            failed_ids.append(session_id)
            continue
        ok = False
        if rec.archived_at is None:
            ok = delete_chat(session_id) and purge_archived_chat(session_id)
        else:
            ok = purge_archived_chat(session_id)
        if ok:
            success_ids.append(session_id)
        else:
            failed_ids.append(session_id)
    return ChatBatchDeleteResult(success_ids=success_ids, failed_ids=failed_ids)


def get_active_chat(session_id: str) -> ChatRecord | None:
    rec = ChatRegistry.get_item(session_id)
    if rec is None or rec.archived_at is not None:
        return None
    return rec


def replace_session_messages(session_id: str, messages: list[ChatMessageIn]) -> None:
    rec = get_active_chat(session_id)
    if rec is None:
        raise ValueError("会话已归档")
    trimmed = [ensure_chat_message_id(m) for m in list(messages)[-MAX_SESSION_MESSAGES:]]
    ChatRegistry.replace_messages(session_id, trimmed)

    def _apply(item: ChatRecord) -> None:
        item.message_count = len(trimmed)
        item.updated_at = utc_now_iso()

    ChatRegistry.update_item(session_id, _apply)
