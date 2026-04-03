"""Read/write ``config/agent_llm.json`` for the factor agent CLI and web UI."""

from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.chat.agent_chat import lc_messages_from_chat_request, sse_event_iter_for_chat
from app.chat.chat_llm import build_chat_model_from_workspace_settings
from app.chat.llm_schemas import ChatRequest, LlmSettings
from app.workspace_config import load_workspace_config, save_workspace_config

router = APIRouter(prefix="/agent", tags=["agent"])

_CONFIG_FILE = "agent/llm.json"


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


@router.post("/chat/stream")
def chat_stream(body: ChatRequest) -> StreamingResponse:
    """SSE (``text/event-stream``): incremental assistant text as JSON lines ``data: {...}``."""
    lc_messages = lc_messages_from_chat_request(body)

    def event_iter():
        try:
            settings = load_workspace_config(
                _CONFIG_FILE,
                LlmSettings,
                default_factory=_defaults,
            )
            llm = build_chat_model_from_workspace_settings(settings)
        except ValueError as e:
            err = f"{e}"
            yield f"data: {json.dumps({'error': err}, ensure_ascii=False)}\n\n"
            return

        yield from sse_event_iter_for_chat(llm, lc_messages=lc_messages)

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
