from __future__ import annotations

from app.chat.schemas import (
    AssistantBlockPublic,
    ChatMessageIn,
    ChatSessionArchivedSummaryPublic,
    ChatSessionDetailPublic,
    ChatSessionRecord,
    ChatSessionsFile,
    ChatSessionSummaryPublic,
    ensure_chat_message_ids,
)
from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator
from app.persistence.models import ChatMessageRow, ChatSessionRow
from app.persistence.sqlite_db import get_session
from sqlmodel import select

CHAT_SESSIONS_FILENAME = "agent/chat_sessions.json"
CHAT_SESSIONS_DIR = "agent/chat_sessions"
MAX_SESSION_MESSAGES = 200


def _session_row_to_record(row: ChatSessionRow) -> ChatSessionRecord:
    return ChatSessionRecord(
        id=row.id,
        title=row.title,
        message_file=ChatSessionRegistry._message_filename(row.id),
        message_count=row.message_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
        archived_at=row.archived_at,
    )


def _session_record_to_row(rec: ChatSessionRecord) -> ChatSessionRow:
    return ChatSessionRow(
        id=rec.id,
        title=rec.title,
        message_count=rec.message_count,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        archived_at=rec.archived_at,
    )


class ChatSessionRegistry:
    id_generator = create_id_generator("ChatSessionRegistry")

    @classmethod
    def _message_filename(cls, session_id: str) -> str:
        return f"{CHAT_SESSIONS_DIR}/{session_id}.messages.json"

    @classmethod
    def _write_messages_file(cls, message_file: str, messages: list[ChatMessageIn]) -> None:
        _ = message_file, messages

    @classmethod
    def generate_id(cls, name: str | None = None) -> str:
        return cls.id_generator(name)

    @classmethod
    def load(cls) -> ChatSessionsFile:
        return ChatSessionsFile(items=cls.list_items())

    @classmethod
    def list_items(cls) -> list[ChatSessionRecord]:
        with get_session() as session:
            rows = list(session.exec(select(ChatSessionRow)))
        return [_session_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, session_id: str) -> ChatSessionRecord | None:
        with get_session() as session:
            row = session.get(ChatSessionRow, session_id)
            return _session_row_to_record(row) if row is not None else None

    @classmethod
    def add_item(cls, item: ChatSessionRecord) -> None:
        with get_session() as session:
            session.add(_session_record_to_row(item))
            session.commit()

    @classmethod
    def update_item(cls, session_id: str, fn) -> ChatSessionRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(ChatSessionRow, session_id)
            if row is None:
                return None
            rec = _session_row_to_record(row)
            fn(rec)
            session.merge(_session_record_to_row(rec))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, session_id: str) -> ChatSessionRecord | None:
        with get_session() as session:
            row = session.get(ChatSessionRow, session_id)
            if row is None:
                return None
            rec = _session_row_to_record(row)
            msgs = list(
                session.exec(select(ChatMessageRow).where(ChatMessageRow.session_id == session_id))
            )
            for m in msgs:
                session.delete(m)
            session.delete(row)
            session.commit()
            return rec

    @classmethod
    def create_session(cls, title: str) -> ChatSessionRecord:
        now = utc_now_iso()
        sid = cls.generate_id()
        rec = ChatSessionRecord(
            id=sid,
            title=title.strip() or "新会话",
            message_file=cls._message_filename(sid),
            message_count=0,
            created_at=now,
            updated_at=now,
        )
        cls.add_item(rec)
        return rec

    @classmethod
    def list_active_items(cls) -> list[ChatSessionRecord]:
        return [item for item in cls.list_items() if item.archived_at is None]

    @classmethod
    def list_archived_items(cls) -> list[ChatSessionRecord]:
        return [item for item in cls.list_items() if item.archived_at is not None]

    @classmethod
    def get_active_item(cls, session_id: str) -> ChatSessionRecord | None:
        rec = cls.get_item(session_id)
        if rec is None or rec.archived_at is not None:
            return None
        return rec

    @classmethod
    def rename_session(cls, session_id: str, title: str) -> ChatSessionRecord | None:
        name = title.strip()
        if not name:
            raise ValueError("title 不能为空")

        def _apply(rec: ChatSessionRecord) -> None:
            if rec.archived_at is not None:
                raise ValueError("会话已归档")
            rec.title = name
            rec.updated_at = utc_now_iso()

        return cls.update_item(session_id, _apply)

    @classmethod
    def replace_messages(
        cls, session_id: str, messages: list[ChatMessageIn]
    ) -> ChatSessionRecord | None:
        trimmed = ensure_chat_message_ids(list(messages)[-MAX_SESSION_MESSAGES:])

        def _apply(rec: ChatSessionRecord) -> None:
            if rec.archived_at is not None:
                raise ValueError("会话已归档")
            with get_session() as session:
                rows = list(
                    session.exec(select(ChatMessageRow).where(ChatMessageRow.session_id == rec.id))
                )
                for r in rows:
                    session.delete(r)
                for m in trimmed:
                    session.add(
                        ChatMessageRow(
                            id=(m.id or "").strip(),
                            session_id=rec.id,
                            role=m.role,
                            blocks=[b.model_dump(mode="json", exclude_none=True) for b in m.blocks],
                            created_at=None,
                        )
                    )
                session.commit()
            rec.message_count = len(trimmed)
            rec.updated_at = utc_now_iso()

        return cls.update_item(session_id, _apply)

    @classmethod
    def archive_session(cls, session_id: str) -> ChatSessionRecord | None:
        rec = cls.get_item(session_id)
        if rec is None:
            return None
        if rec.archived_at is not None:
            return rec

        def _apply(item: ChatSessionRecord) -> None:
            now = utc_now_iso()
            item.archived_at = now
            item.updated_at = now

        return cls.update_item(session_id, _apply)

    @classmethod
    def delete_session(cls, session_id: str) -> ChatSessionRecord | None:
        return cls.archive_session(session_id)

    @classmethod
    def restore_session(cls, session_id: str) -> ChatSessionRecord | None:
        rec = cls.get_item(session_id)
        if rec is None or rec.archived_at is None:
            return None

        def _apply(item: ChatSessionRecord) -> None:
            item.archived_at = None
            item.updated_at = utc_now_iso()

        return cls.update_item(session_id, _apply)

    @classmethod
    def purge_archived_session(cls, session_id: str) -> ChatSessionRecord | None:
        rec = cls.get_item(session_id)
        if rec is None or rec.archived_at is None:
            return None

        deleted = cls.delete_item(session_id)
        if deleted is None:
            return None
        return deleted

    @classmethod
    def get_messages(cls, session_id: str) -> list[ChatMessageIn] | None:
        rec = cls.get_active_item(session_id)
        if rec is None:
            return None
        with get_session() as session:
            rows = list(
                session.exec(select(ChatMessageRow).where(ChatMessageRow.session_id == session_id))
            )
        out: list[ChatMessageIn] = []
        for r in rows:
            out.append(
                ChatMessageIn(
                    id=r.id,
                    role=r.role,  # type: ignore[arg-type]
                    blocks=[AssistantBlockPublic.model_validate(b) for b in (r.blocks or [])],
                )
            )
        return ensure_chat_message_ids(out)


def record_to_summary(rec: ChatSessionRecord) -> ChatSessionSummaryPublic:
    return ChatSessionSummaryPublic(
        id=rec.id,
        title=rec.title,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        message_count=rec.message_count,
    )


def record_to_archived_summary(rec: ChatSessionRecord) -> ChatSessionArchivedSummaryPublic:
    if not rec.archived_at:
        raise ValueError("session is not archived")
    return ChatSessionArchivedSummaryPublic(
        **record_to_summary(rec).model_dump(),
        archived_at=rec.archived_at,
    )


def record_to_detail(rec: ChatSessionRecord) -> ChatSessionDetailPublic:
    return ChatSessionDetailPublic(
        id=rec.id,
        title=rec.title,
        messages=ChatSessionRegistry.get_messages(rec.id) or [],
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )
