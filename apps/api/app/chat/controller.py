"""Chat module controller: orchestrates LLM/chat-session business logic."""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import suppress
from typing import Any

from app.chat.agent import (
    stream_event_aiter_for_chat,
)
from app.chat.events import (
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
from app.chat.registry import (
    ChatRegistry,
    record_to_archived_summary,
    record_to_detail,
    record_to_summary,
)
from app.chat.schemas import (
    AssistantBlockPublic,
    ChatArchivedSummaryPublic,
    ChatAuthorizationRequest,
    ChatCreateBody,
    ChatDetailPublic,
    ChatMessageIn,
    ChatRecord,
    ChatRenameBody,
    ChatRequest,
    ChatSummaryPublic,
    ChatToolCallPublic,
    LlmSettings,
    ensure_chat_message_id,
)
from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator
from app.config import controller as config_controller
from app.config import register_config_spec
from app.config.schema import ConfigModuleSpec
from diskcache import Cache
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from workspace import workspace_path

_LLM_CONFIG_MODULE = "agent_llm"
MAX_SESSION_MESSAGES = 200
_CHAT_ID_GENERATOR = create_id_generator("ChatRegistry")
_AUTH_PENDING_TTL_SECONDS = 10 * 60
_AUTH_WAIT_POLL_SECONDS = 0.2
_AUTH_CACHE = Cache(str(workspace_path(".quant-agent/chat_auth_cache")))


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


def build_chat_model_from_workspace_settings(
    settings: LlmSettings,
) -> BaseChatModel:
    temperature = settings.temperature
    provider = settings.provider if settings.provider in ("ollama", "openai") else "ollama"
    model = settings.model.strip() if settings.model else "qwen3.5:9b"

    if provider == "openai":
        api_key = (settings.api_key or "").strip() or None
        if not api_key:
            raise ValueError(
                "OpenAI 提供方需要 API 密钥：在 Web Agent 页面保存 api_key"
                "（写入 config/agent/llm.json）。"
            )
        openai_kwargs: dict[str, Any] = {
            "temperature": temperature,
            "api_key": api_key,
        }
        ob = (settings.openai_base_url or "").strip()
        if ob:
            openai_kwargs["base_url"] = ob.rstrip("/")
        return init_chat_model(f"openai:{model}", **openai_kwargs)

    timeout = settings.ollama_timeout
    num_predict = settings.ollama_num_predict
    base_url = (settings.ollama_base_url or "").strip()
    reasoning = settings.ollama_reasoning

    client_kwargs: dict[str, Any] = {"timeout": timeout}
    kwargs: dict[str, Any] = {
        "temperature": temperature,
        "base_url": base_url.rstrip("/"),
        "num_predict": num_predict,
        "client_kwargs": client_kwargs,
    }
    if reasoning is not None:
        kwargs["reasoning"] = reasoning

    return init_chat_model(f"ollama:{model}", **kwargs)


def _register_llm_settings_module() -> None:
    defaults = LlmSettings().model_dump(mode="json")
    rjsf_schema, rjsf_ui_schema = LlmSettings.rjsf_schema_and_ui_schema()
    spec = ConfigModuleSpec(
        key=_LLM_CONFIG_MODULE,
        title="模型与密钥",
        description="配置因子挖掘智能体使用的 LLM。",
        filename="chat/llm.json",
        default_values=defaults,
        json_schema=rjsf_schema,
        ui_schema=rjsf_ui_schema,
    )
    # Module reload may execute this file repeatedly in dev mode.
    with suppress(ValueError):
        register_config_spec(spec)


def _build_llm_from_workspace():
    settings = get_llm_settings()
    return build_chat_model_from_workspace_settings(settings)


def _append_delta_block(blocks: list[AssistantBlockPublic], delta: str) -> None:
    if not blocks:
        blocks.append(AssistantBlockPublic(kind="text", content=delta))
        return
    last = blocks[-1]
    if last.kind == "text":
        last.content = (last.content or "") + delta
    else:
        blocks.append(AssistantBlockPublic(kind="text", content=delta))


def _append_reasoning_block(blocks: list[AssistantBlockPublic], delta: str) -> None:
    if not blocks:
        blocks.append(AssistantBlockPublic(kind="reasoning", content=delta))
        return
    last = blocks[-1]
    if last.kind == "reasoning":
        last.content = (last.content or "") + delta
    else:
        blocks.append(AssistantBlockPublic(kind="reasoning", content=delta))


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


def _apply_stream_event_to_blocks(
    blocks: list[AssistantBlockPublic],
    event: StreamEventAny,
) -> None:
    if isinstance(event, (ErrorEvent, MessageIdsEvent, DoneEvent)):
        return
    if isinstance(event, DeltaEvent):
        _append_delta_block(blocks, event.payload)
        return

    if isinstance(event, ReasoningEvent):
        _append_reasoning_block(blocks, event.payload)
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


def _persist_user_messages_on_receive(session_id: str, message: ChatMessageIn) -> None:
    rec = get_active_chat(session_id)
    if rec is None:
        return
    message_filled = ensure_chat_message_id(message)
    try:
        if rec.message_count < MAX_SESSION_MESSAGES:
            ChatRegistry.append_message(session_id, message_filled)
            return
        keep = (ChatRegistry.get_messages(session_id) or [])[-(MAX_SESSION_MESSAGES - 1) :]
        replace_session_messages(session_id, [*keep, message_filled])
    except ValueError:
        return


def get_llm_settings() -> LlmSettings:
    values = config_controller.get_module_config(_LLM_CONFIG_MODULE)
    return LlmSettings.model_validate(values)


def put_llm_settings(body: LlmSettings) -> LlmSettings:
    values = config_controller.put_module_config(
        _LLM_CONFIG_MODULE,
        body.model_dump(mode="json", exclude_none=False),
    )
    return LlmSettings.model_validate(values)


_register_llm_settings_module()


def _build_chat_context_messages(
    session_id: str,
    incoming_user: ChatMessageIn,
) -> tuple[list[ChatMessageIn], list[ChatMessageIn]]:
    history_messages = ChatRegistry.get_messages(session_id) or []
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

    _persist_user_messages_on_receive(session_id, incoming_user)
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
            llm = _build_llm_from_workspace()
            pending_decision: dict[str, Any] | None = None
            while True:
                stream_kwargs: dict[str, Any] = {
                    "thread_id": thread_id,
                }
                if pending_decision is None:
                    stream_kwargs["chat_messages"] = context_messages
                else:
                    stream_kwargs["decision"] = pending_decision

                interrupted = False
                async for event in stream_event_aiter_for_chat(
                    llm,
                    **stream_kwargs,
                ):
                    if await is_disconnected():
                        return
                    _apply_stream_event_to_blocks(blocks, event)
                    is_authorize_event = (
                        isinstance(event, ToolEvent) and event.payload.stage == "authorize"
                    )
                    if is_authorize_event:
                        interrupted = True
                        # Register pending authorization before emitting SSE authorize event,
                        # so fast clients cannot race /chat/authorize ahead of this context.
                        _register_pending_auth(
                            thread_id=thread_id,
                            session_id=session_id,
                            assistant_message_id=assistant_message_id,
                        )
                    if await is_disconnected():
                        return
                    await out.put(_sse_wire_frame(event))
                    if is_authorize_event:
                        try:
                            pending_decision = await _wait_for_authorization_decision(
                                thread_id=thread_id,
                                is_disconnected=is_disconnected,
                            )
                        finally:
                            _clear_pending_auth(thread_id)
                        if pending_decision is None:
                            return
                        break

                if not interrupted:
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
        if not producer_task.done():
            producer_task.cancel()
            with suppress(asyncio.CancelledError):
                await producer_task


def list_chats() -> list[ChatSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is None]
    items.sort(key=lambda i: i.updated_at, reverse=True)
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
        body.decision.model_dump(mode="json"),
        expire=_AUTH_PENDING_TTL_SECONDS,
    )
    return {"status": "accepted"}


def list_archived_chats() -> list[ChatArchivedSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is not None]
    items.sort(key=lambda i: i.archived_at or "", reverse=True)
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
