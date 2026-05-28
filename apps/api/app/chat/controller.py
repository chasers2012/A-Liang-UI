"""Chat module controller: orchestrates LLM/chat-session business logic."""

from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator

from . import stream_control
from .registry import ChatRegistry
from .schemas import (
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
    ensure_chat_message_id,
)

MAX_SESSION_MESSAGES = 200
_CHAT_ID_GENERATOR = create_id_generator("ChatRegistry")


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


async def stream_async(
    body: ChatRequest,
    *,
    is_disconnected: Callable[[], Awaitable[bool]],
) -> AsyncIterator[str]:
    async for event in stream_control.stream_async(
        body,
        is_disconnected=is_disconnected,
        get_active_chat=get_active_chat,
        replace_session_messages=replace_session_messages,
    ):
        yield event


def stop_stream(body: ChatStopRequest) -> dict[str, Any]:
    return stream_control.stop_stream(body)


def list_chats() -> list[ChatSummaryPublic]:
    items = [i for i in ChatRegistry.list_items() if i.archived_at is None]
    items.sort(key=lambda i: i.created_at, reverse=True)
    return [record_to_summary(i) for i in items]


def submit_authorization(body: ChatAuthorizationRequest) -> dict[str, Any]:
    return stream_control.submit_authorization(body)


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
