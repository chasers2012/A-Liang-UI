from __future__ import annotations

from app.chat.schemas import (
    AssistantBlockPublic,
    ChatArchivedSummaryPublic,
    ChatDetailPublic,
    ChatMessageIn,
    ChatRecord,
    ChatsFile,
    ChatSummaryPublic,
)
from app.persistence.models import ChatMessageRow, ChatRow
from app.persistence.sqlite_db import get_session
from sqlmodel import select

CHATS_DIR = "chat"


class ChatRegistry:
    @classmethod
    def _message_filename(cls, chat_id: str) -> str:
        return f"{CHATS_DIR}/{chat_id}.messages.json"

    @classmethod
    def _write_messages_file(cls, message_file: str, messages: list[ChatMessageIn]) -> None:
        _ = message_file, messages

    @classmethod
    def load(cls) -> ChatsFile:
        return ChatsFile(items=cls.list_items())

    @classmethod
    def list_items(cls) -> list[ChatRecord]:
        with get_session() as db:
            rows = list(db.exec(select(ChatRow)))
        return [
            ChatRecord(
                id=r.id,
                title=r.title,
                message_file=cls._message_filename(r.id),
                message_count=r.message_count,
                created_at=r.created_at,
                updated_at=r.updated_at,
                archived_at=r.archived_at,
            )
            for r in rows
        ]

    @classmethod
    def get_item(cls, chat_id: str) -> ChatRecord | None:
        with get_session() as db:
            row = db.get(ChatRow, chat_id)
            if row is None:
                return None
            return ChatRecord(
                id=row.id,
                title=row.title,
                message_file=cls._message_filename(row.id),
                message_count=row.message_count,
                created_at=row.created_at,
                updated_at=row.updated_at,
                archived_at=row.archived_at,
            )

    @classmethod
    def add_item(cls, item: ChatRecord) -> None:
        with get_session() as db:
            db.add(
                ChatRow(
                    id=item.id,
                    title=item.title,
                    message_count=item.message_count,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    archived_at=item.archived_at,
                )
            )
            db.commit()

    @classmethod
    def update_item(cls, chat_id: str, fn) -> ChatRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as db:
            row = db.get(ChatRow, chat_id)
            if row is None:
                return None
            rec = ChatRecord(
                id=row.id,
                title=row.title,
                message_file=cls._message_filename(row.id),
                message_count=row.message_count,
                created_at=row.created_at,
                updated_at=row.updated_at,
                archived_at=row.archived_at,
            )
            fn(rec)
            db.merge(
                ChatRow(
                    id=rec.id,
                    title=rec.title,
                    message_count=rec.message_count,
                    created_at=rec.created_at,
                    updated_at=rec.updated_at,
                    archived_at=rec.archived_at,
                )
            )
            db.commit()
            return rec

    @classmethod
    def delete_item(cls, chat_id: str) -> ChatRecord | None:
        with get_session() as db:
            row = db.get(ChatRow, chat_id)
            if row is None:
                return None
            rec = ChatRecord(
                id=row.id,
                title=row.title,
                message_file=cls._message_filename(row.id),
                message_count=row.message_count,
                created_at=row.created_at,
                updated_at=row.updated_at,
                archived_at=row.archived_at,
            )
            msgs = list(db.exec(select(ChatMessageRow).where(ChatMessageRow.session_id == chat_id)))
            for m in msgs:
                db.delete(m)
            db.delete(row)
            db.commit()
            return rec

    @classmethod
    def replace_messages(cls, chat_id: str, messages: list[ChatMessageIn]) -> None:
        with get_session() as db:
            rows = list(db.exec(select(ChatMessageRow).where(ChatMessageRow.session_id == chat_id)))
            for r in rows:
                db.delete(r)
            for m in messages:
                db.add(
                    ChatMessageRow(
                        id=(m.id or "").strip(),
                        session_id=chat_id,
                        role=m.role,
                        blocks=[b.model_dump(mode="json", exclude_none=True) for b in m.blocks],
                        created_at=None,
                    )
                )
            db.commit()

    @classmethod
    def get_messages(cls, chat_id: str) -> list[ChatMessageIn] | None:
        rec = cls.get_item(chat_id)
        if rec is None:
            return None
        with get_session() as db:
            rows = list(db.exec(select(ChatMessageRow).where(ChatMessageRow.session_id == chat_id)))
        out: list[ChatMessageIn] = []
        for r in rows:
            out.append(
                ChatMessageIn(
                    id=r.id,
                    role=r.role,  # type: ignore[arg-type]
                    blocks=[AssistantBlockPublic.model_validate(b) for b in (r.blocks or [])],
                )
            )
        return out


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
