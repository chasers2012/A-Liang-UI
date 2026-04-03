"""Read/write ``config/agent_llm.json`` for the factor agent CLI and web UI."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.chat.agent_chat import lc_messages_from_chat_request, sse_event_iter_for_chat
from app.chat.chat_llm import build_chat_model_from_workspace_settings
from app.chat.llm_schemas import (
    ChatMessageIn,
    ChatRequest,
    ChatSessionCreateBody,
    ChatSessionDetailPublic,
    ChatSessionRenameBody,
    ChatSessionSummaryPublic,
    LlmSettings,
)
from app.chat.session_registry import ChatSessionRegistry, record_to_detail, record_to_summary
from app.workspace_config import load_workspace_config, save_workspace_config

router = APIRouter(prefix="/agent", tags=["agent"])

_CONFIG_FILE = "agent/llm.json"


def _defaults() -> LlmSettings:
    return LlmSettings()


def _build_llm_from_workspace():
    settings = load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )
    return build_chat_model_from_workspace_settings(settings)


def _consume_sse_event(event: str, assistant_text_parts: list[str], saw_error: bool) -> bool:
    if not event.startswith("data: "):
        return saw_error
    raw = event.removeprefix("data: ").strip()
    if not raw:
        return saw_error
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        return saw_error
    if isinstance(payload.get("delta"), str):
        assistant_text_parts.append(payload["delta"])
    if isinstance(payload.get("error"), str):
        return True
    return saw_error


def _persist_chat_session_if_needed(
    body: ChatRequest, assistant_text_parts: list[str], saw_error: bool
) -> None:
    if saw_error or not body.session_id:
        return
    session = ChatSessionRegistry.get_item(body.session_id)
    if session is None:
        return

    final_messages = list(body.messages)
    assistant_text = "".join(assistant_text_parts).strip()
    if assistant_text:
        final_messages.append(ChatMessageIn(role="assistant", content=assistant_text))
    ChatSessionRegistry.replace_messages(body.session_id, final_messages)


@router.get("/llm-settings", response_model=LlmSettings)
def get_llm_settings() -> LlmSettings:
    return load_workspace_config(
        _CONFIG_FILE,
        LlmSettings,
        default_factory=_defaults,
    )


@router.put("/llm-settings", response_model=LlmSettings)
def put_llm_settings(body: LlmSettings) -> LlmSettings:
    save_workspace_config(_CONFIG_FILE, body)
    return body


@router.post("/chat/stream")
def chat_stream(body: ChatRequest) -> StreamingResponse:
    """SSE (``text/event-stream``): incremental assistant text as JSON lines ``data: {...}``."""
    lc_messages = lc_messages_from_chat_request(body)

    def event_iter():
        assistant_text_parts: list[str] = []
        saw_error = False
        try:
            llm = _build_llm_from_workspace()
        except ValueError as e:
            err = f"{e}"
            saw_error = True
            yield f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n"
            return

        for event in sse_event_iter_for_chat(llm, lc_messages=lc_messages):
            saw_error = _consume_sse_event(event, assistant_text_parts, saw_error)
            yield event

        _persist_chat_session_if_needed(body, assistant_text_parts, saw_error)

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/sessions", response_model=list[ChatSessionSummaryPublic])
def list_chat_sessions() -> list[ChatSessionSummaryPublic]:
    items = ChatSessionRegistry.list_items()
    items.sort(key=lambda i: i.updated_at, reverse=True)
    return [record_to_summary(i) for i in items]


@router.post("/chat/sessions", response_model=ChatSessionDetailPublic)
def create_chat_session(body: ChatSessionCreateBody) -> ChatSessionDetailPublic:
    rec = ChatSessionRegistry.create_session(body.title)
    return record_to_detail(rec)


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetailPublic)
def get_chat_session(session_id: str) -> ChatSessionDetailPublic:
    rec = ChatSessionRegistry.get_item(session_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return record_to_detail(rec)


@router.patch("/chat/sessions/{session_id}", response_model=ChatSessionDetailPublic)
def rename_chat_session(session_id: str, body: ChatSessionRenameBody) -> ChatSessionDetailPublic:
    try:
        rec = ChatSessionRegistry.rename_session(session_id, body.title)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return record_to_detail(rec)


@router.delete("/chat/sessions/{session_id}", status_code=204)
def delete_chat_session(session_id: str) -> None:
    rec = ChatSessionRegistry.delete_session(session_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")
