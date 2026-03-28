"""Read/write ``config/agent_llm.json`` for the factor agent CLI and web UI."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agent_llm_schemas import AgentChatRequest, AgentChatResponse, AgentLlmSettings
from app.workspace_config import load_workspace_config, save_workspace_config

router = APIRouter(prefix="/agent", tags=["agent"])

_CONFIG_FILE = "agent_llm.json"


def _defaults() -> AgentLlmSettings:
    return AgentLlmSettings()


@router.get("/llm-settings", response_model=AgentLlmSettings)
def get_llm_settings() -> AgentLlmSettings:
    return load_workspace_config(
        _CONFIG_FILE,
        AgentLlmSettings,
        default_factory=_defaults,
    )


@router.put("/llm-settings", response_model=AgentLlmSettings)
def put_llm_settings(body: AgentLlmSettings) -> AgentLlmSettings:
    save_workspace_config(_CONFIG_FILE, body)
    return body


def _lc_messages_from_chat_request(body: AgentChatRequest):
    from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

    lc_messages: list[BaseMessage] = []
    for m in body.messages:
        if m.role == "system":
            lc_messages.append(SystemMessage(content=m.content))
        elif m.role == "user":
            lc_messages.append(HumanMessage(content=m.content))
        else:
            lc_messages.append(AIMessage(content=m.content))
    return lc_messages


@router.post("/chat", response_model=AgentChatResponse)
def agent_chat(body: AgentChatRequest) -> AgentChatResponse:
    """Free-form chat using the same LLM as the factor agent (Ollama / OpenAI)."""
    from agent.llm import build_chat_llm, message_text, stream_llm

    lc_messages = _lc_messages_from_chat_request(body)

    try:
        llm = build_chat_llm()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        out = stream_llm(llm, lc_messages, stage="chat")
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"LLM 调用失败：{e}",
        ) from e

    return AgentChatResponse(content=message_text(out))


@router.post("/chat/stream")
def agent_chat_stream(body: AgentChatRequest) -> StreamingResponse:
    """SSE (``text/event-stream``): incremental assistant text as JSON lines ``data: {...}``."""
    from agent.llm import build_chat_llm, iter_llm_stream_text_deltas

    lc_messages = _lc_messages_from_chat_request(body)

    def event_iter():
        try:
            llm = build_chat_llm()
        except ValueError as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
            return
        try:
            for delta in iter_llm_stream_text_deltas(
                llm,
                lc_messages,
                stage="chat",
                force_stream=True,
            ):
                if delta:
                    yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"
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
