"""Chat module controller: orchestrates LLM/chat-session business logic."""

from __future__ import annotations

import json
import queue
import threading
import uuid
from collections.abc import Iterator
from typing import Any

from app.chat.agent import sse_event_iter_for_chat
from app.chat.registry import (
    ChatRegistry,
    record_to_archived_summary,
    record_to_detail,
    record_to_summary,
)
from app.chat.schemas import (
    AssistantBlockPublic,
    ChatArchivedSummaryPublic,
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
from app.workspace_config import load_workspace_config, save_workspace_config
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from pydantic import BaseModel

_CONFIG_FILE = "agent/llm.json"
MAX_SESSION_MESSAGES = 200
_CHAT_ID_GENERATOR = create_id_generator("ChatRegistry")


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
                "（写入 config/agent_llm.json）。"
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


def _defaults() -> LlmSettings:
    return LlmSettings()


def _build_llm_from_workspace():
    settings = load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )
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


def _patch_tool_block(
    blocks: list[AssistantBlockPublic],
    tc_id: str,
    *,
    ok: bool,
    result: Any,
    error: str | None,
) -> None:
    for b in blocks:
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


def _apply_stream_event_to_blocks(blocks: list[AssistantBlockPublic], event: BaseModel) -> bool:
    """Return True if payload contained stream ``error``."""
    error = getattr(event, "error", None)
    if isinstance(error, str):
        return True
    if getattr(event, "message_ids", None) is not None:
        return False
    delta = getattr(event, "delta", None)
    if isinstance(delta, str) and delta:
        _append_delta_block(blocks, delta)
    ts = getattr(event, "tool_start", None)
    if ts is not None:
        blocks.append(
            AssistantBlockPublic(
                kind="tool",
                call=ChatToolCallPublic(
                    id=ts.id,
                    name=ts.name,
                    args=ts.args,
                    status="running",
                ),
            )
        )
    tr = getattr(event, "tool_result", None)
    if tr is not None:
        _patch_tool_block(
            blocks,
            tr.id,
            ok=True,
            result=tr.result,
            error=None,
        )
    te = getattr(event, "tool_error", None)
    if te is not None:
        _patch_tool_block(
            blocks,
            te.id,
            ok=False,
            result=None,
            error=te.error or "",
        )
    return False


def _persist_chat_if_needed(
    session_id: str,
    messages: list[ChatMessageIn],
    blocks: list[AssistantBlockPublic],
    saw_error: bool,
    assistant_message_id: str,
) -> None:
    if saw_error:
        return
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
    return load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )


def put_llm_settings(body: LlmSettings) -> LlmSettings:
    save_workspace_config(_CONFIG_FILE, body)
    return body


def stream(body: ChatRequest) -> Iterator[str]:
    session = get_active_chat(body.session_id)
    if session is None:
        raise ValueError("会话不存在或已归档")

    # Request carries exactly one new user message; model context is built from
    # persisted history + this single incoming turn.
    incoming_user = ensure_chat_message_id(body.message)
    if not incoming_user.id:
        raise ValueError("user 消息 id 生成失败")

    history_messages = ChatRegistry.get_messages(body.session_id) or []
    context_messages = [*history_messages, incoming_user]
    last_user_id = incoming_user.id
    assistant_message_id = str(uuid.uuid4())

    _persist_user_messages_on_receive(body.session_id, incoming_user)
    out: queue.Queue[str | None] = queue.Queue()

    def _producer() -> None:
        blocks: list[AssistantBlockPublic] = []
        saw_error = False
        try:
            out.put(
                f"data: {json.dumps({'message_ids': {'user': last_user_id, 'assistant': assistant_message_id}}, ensure_ascii=False)}\n\n"
            )
            llm = _build_llm_from_workspace()

            for event in sse_event_iter_for_chat(llm, chat_messages=context_messages):
                if _apply_stream_event_to_blocks(blocks, event):
                    saw_error = True
                out.put(f"data: {event.model_dump_json(exclude_none=True)}\n\n")
        except ValueError as e:
            err = f"{e}"
            saw_error = True
            out.put(f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n")
            return
        finally:
            try:
                _persist_chat_if_needed(
                    body.session_id,
                    context_messages,
                    blocks,
                    saw_error,
                    assistant_message_id,
                )
            finally:
                out.put(None)

    threading.Thread(target=_producer, daemon=True).start()

    def _iter() -> Iterator[str]:
        while True:
            ev = out.get()
            if ev is None:
                return
            yield ev

    return _iter()


def list_chats() -> list[ChatSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is None]
    items.sort(key=lambda i: i.updated_at, reverse=True)
    return [record_to_summary(i) for i in items]


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
