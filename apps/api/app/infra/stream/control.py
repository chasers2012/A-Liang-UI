"""SSE streaming flow control (protocol layer)."""

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

from app.infra.llm import build_chat_model
from app.packages.chat.schemas import (
    AssistantBlockPublic,
    ChatAuthorizationRequest,
    ChatMessageIn,
    ChatRequest,
    ChatStopRequest,
    ChatToolCallPublic,
    ensure_chat_message_id,
    message_text_for_model,
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

_AUTH_PENDING_TTL_SECONDS = 10 * 60
_AUTH_WAIT_POLL_SECONDS = 0.2


def _workspace_auth_cache() -> Cache:
    from workspace import workspace_path

    return Cache(str(workspace_path(".a-liang-ui/chat_auth_cache")))


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
    candidates.sort(key=lambda item: float(item[1].get("started_at", 0.0)), reverse=True)
    return candidates[0][0]


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
    _workspace_auth_cache().set(
        _auth_pending_key(thread_id),
        {
            "session_id": session_id,
            "assistant_message_id": assistant_message_id,
        },
        expire=_AUTH_PENDING_TTL_SECONDS,
    )
    _workspace_auth_cache().delete(_auth_decision_key(thread_id))


def _clear_pending_auth(thread_id: str) -> None:
    _workspace_auth_cache().delete(_auth_pending_key(thread_id))
    _workspace_auth_cache().delete(_auth_decision_key(thread_id))


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
    *,
    get_active_chat: Callable[[str], Any | None],
    replace_session_messages: Callable[[str, list[ChatMessageIn]], None],
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
    from app.packages.chat.registry import ChatRegistry

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
    *,
    get_active_chat: Callable[[str], Any | None],
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
        decision = _workspace_auth_cache().get(decision_key, default=None)
        if isinstance(decision, dict):
            _workspace_auth_cache().delete(decision_key)
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
    get_active_chat: Callable[[str], Any | None],
    replace_session_messages: Callable[[str, list[ChatMessageIn]], None],
) -> AsyncIterator[str]:
    from app.packages.chat.agent import stream_event_aiter_for_chat

    session_id, incoming_user, persisted_context_messages, context_messages = _prepare_chat_stream(
        body,
        get_active_chat=get_active_chat,
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
                    get_active_chat=get_active_chat,
                    replace_session_messages=replace_session_messages,
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


def submit_authorization(body: ChatAuthorizationRequest) -> dict[str, Any]:
    thread_id = f"{body.session_id}:{body.assistant_message_id}"

    pending = _workspace_auth_cache().get(_auth_pending_key(thread_id), default=None)
    if not pending:
        raise ValueError("未找到待授权的运行上下文，可能已超时或已完成。")

    session_id = pending["session_id"]
    if session_id != body.session_id:
        raise ValueError("session_id 不匹配")
    if pending["assistant_message_id"] != body.assistant_message_id:
        raise ValueError("assistant_message_id 不匹配")

    _workspace_auth_cache().set(
        _auth_decision_key(thread_id),
        {
            "decisions": [d.model_dump(mode="json") for d in body.decisions],
        },
        expire=_AUTH_PENDING_TTL_SECONDS,
    )
    return {"status": "accepted"}
