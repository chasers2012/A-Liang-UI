"""Chat API routes (thin HTTP layer)."""

from __future__ import annotations

from app.chat import controller
from app.chat.schemas import (
    ChatArchivedSummaryPublic,
    ChatCreateBody,
    ChatDetailPublic,
    ChatRenameBody,
    ChatRequest,
    ChatSummaryPublic,
    LlmSettings,
)
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/llm-settings", response_model=LlmSettings)
def get_llm_settings() -> LlmSettings:
    return controller.get_llm_settings()


@router.put("/llm-settings", response_model=LlmSettings)
def put_llm_settings(body: LlmSettings) -> LlmSettings:
    return controller.put_llm_settings(body)


@router.post("/message")
def chat_stream(body: ChatRequest) -> StreamingResponse:
    """SSE (``text/event-stream``): incremental assistant text as JSON lines ``data: {...}``."""
    try:
        stream = controller.iter_chat_stream_sse(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("", response_model=list[ChatSummaryPublic])
def list_chats() -> list[ChatSummaryPublic]:
    return controller.list_chats()


@router.get(
    "/archived",
    response_model=list[ChatArchivedSummaryPublic],
)
def list_archived_chats() -> list[ChatArchivedSummaryPublic]:
    return controller.list_archived_chats()


@router.post(
    "",
    response_model=ChatDetailPublic,
    response_model_exclude_none=True,
)
def create_chat(body: ChatCreateBody) -> ChatDetailPublic:
    return controller.create_chat(body)


@router.get(
    "/{session_id}",
    response_model=ChatDetailPublic,
    response_model_exclude_none=True,
)
def get_chat(session_id: str) -> ChatDetailPublic:
    rec = controller.get_chat(session_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return rec


@router.patch(
    "/{session_id}",
    response_model=ChatDetailPublic,
    response_model_exclude_none=True,
)
def rename_chat(session_id: str, body: ChatRenameBody) -> ChatDetailPublic:
    try:
        rec = controller.rename_chat(session_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return rec


@router.delete("/{session_id}", status_code=204)
def delete_chat(session_id: str) -> None:
    if not controller.delete_chat(session_id):
        raise HTTPException(status_code=404, detail="会话不存在")


@router.post(
    "/{session_id}/restore",
    response_model=ChatDetailPublic,
    response_model_exclude_none=True,
)
def restore_chat(session_id: str) -> ChatDetailPublic:
    rec = controller.restore_chat(session_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="会话不存在或未被归档")
    return rec


@router.delete("/{session_id}/archived", status_code=204)
def purge_archived_chat(session_id: str) -> None:
    if not controller.purge_archived_chat(session_id):
        raise HTTPException(status_code=404, detail="会话不存在或未被归档")
