"""Read/write ``config/agent_llm.json`` for the factor agent CLI and web UI."""

from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.chat.chat_llm import build_chat_model_from_workspace_settings, stream_chunk_text
from app.chat.llm_schemas import ChatRequest, LlmSettings
from app.workspace_config import load_workspace_config, save_workspace_config

router = APIRouter(prefix="/agent", tags=["agent"])

_CONFIG_FILE = "agent_llm.json"


def _defaults() -> LlmSettings:
    return LlmSettings()


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


def _lc_messages_from_chat_request(body: ChatRequest):

    lc_messages: list[BaseMessage] = []
    for m in body.messages:
        if m.role == "system":
            lc_messages.append(SystemMessage(content=m.content))
        elif m.role == "user":
            lc_messages.append(HumanMessage(content=m.content))
        else:
            lc_messages.append(AIMessage(content=m.content))
    return lc_messages


@router.post("/chat/stream")
def chat_stream(body: ChatRequest) -> StreamingResponse:
    """SSE (``text/event-stream``): incremental assistant text as JSON lines ``data: {...}``."""
    lc_messages = _lc_messages_from_chat_request(body)

    def event_iter():
        try:
            settings = load_workspace_config(
                _CONFIG_FILE,
                LlmSettings,
                default_factory=_defaults,
            )
            llm = build_chat_model_from_workspace_settings(settings)
        except ValueError as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            return
        try:
            for chunk in llm.stream(lc_messages):
                piece = stream_chunk_text(chunk)
                if piece:
                    yield f"data: {json.dumps({'delta': piece}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'LLM 调用失败：{e}'}, ensure_ascii=False)}\n\n"
            return
        yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
