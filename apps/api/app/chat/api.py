"""Chat API routes (thin HTTP layer)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from . import controller
from .schemas import (
    ChatArchivedSummaryPublic,
    ChatAuthorizationRequest,
    ChatBatchDeleteBody,
    ChatBatchDeleteResult,
    ChatBatchUpdateBody,
    ChatBatchUpdateResult,
    ChatCreateBody,
    ChatDetailPublic,
    ChatRenameBody,
    ChatRequest,
    ChatSummaryPublic,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message")
def chat_stream(body: ChatRequest, request: Request) -> StreamingResponse:
    """SSE (``text/event-stream``): ``event:`` = stream kind; ``data:`` = JSON payload only."""
    try:
        stream = controller.stream_async(body, is_disconnected=request.is_disconnected)
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


@router.post("/authorize")
def chat_authorize(body: ChatAuthorizationRequest) -> dict[str, str]:
    """Submit authorization decision and return immediately."""
    try:
        return controller.submit_authorization(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


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


@router.post(
    "/batch/update",
    response_model=ChatBatchUpdateResult,
)
def batch_update_chats(body: ChatBatchUpdateBody) -> ChatBatchUpdateResult:
    return controller.batch_update_chats(body)


@router.post(
    "/batch/delete",
    response_model=ChatBatchDeleteResult,
)
def batch_delete_chats(body: ChatBatchDeleteBody) -> ChatBatchDeleteResult:
    return controller.batch_delete_chats(body)
