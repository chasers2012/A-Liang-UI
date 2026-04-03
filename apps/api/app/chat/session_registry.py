from __future__ import annotations

import json
from typing import Any

from app.chat.llm_schemas import (
    ChatMessageIn,
    ChatSessionDetailPublic,
    ChatSessionRecord,
    ChatSessionsFile,
    ChatSessionSummaryPublic,
)
from app.datetime_utils import utc_now_iso
from app.persistence.workspace_registry import WorkspaceItemsRegistry
from app.workspace_config import save_workspace_config, workspace_config_path

CHAT_SESSIONS_FILENAME = "agent/chat_sessions.json"
CHAT_SESSIONS_DIR = "agent/chat_sessions"
MAX_SESSION_MESSAGES = 200


class ChatSessionRegistry(WorkspaceItemsRegistry[ChatSessionRecord, ChatSessionsFile]):
    filename = CHAT_SESSIONS_FILENAME
    file_model = ChatSessionsFile

    @classmethod
    def _message_filename(cls, session_id: str) -> str:
        return f"{CHAT_SESSIONS_DIR}/{session_id}.messages.json"

    @classmethod
    def _read_messages_file(cls, message_file: str) -> list[ChatMessageIn]:
        path = workspace_config_path(message_file)
        if not path.is_file():
            return []
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return []
        data: Any = json.loads(raw)
        if not isinstance(data, list):
            return []
        out: list[ChatMessageIn] = []
        for m in data:
            if isinstance(m, dict):
                out.append(ChatMessageIn.model_validate(m))
        return out

    @classmethod
    def _write_messages_file(cls, message_file: str, messages: list[ChatMessageIn]) -> None:
        path = workspace_config_path(message_file)
        payload = [m.model_dump() for m in messages]
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @classmethod
    def _load_raw_items(cls) -> list[Any]:
        path = workspace_config_path(cls.filename)
        if not path.is_file():
            return []
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return []
        data: Any = json.loads(raw)
        if not isinstance(data, dict):
            return []
        items = data.get("items")
        if not isinstance(items, list):
            return []
        return items

    @classmethod
    def _migrate_item(cls, it: dict[str, Any]) -> tuple[dict[str, Any] | None, bool]:
        sid = str(it.get("id") or "").strip()
        if not sid:
            return None, False

        migrated = False
        legacy_messages = it.get("messages")
        if "message_file" not in it:
            it["message_file"] = cls._message_filename(sid)
            migrated = True
        if "message_count" not in it:
            it["message_count"] = 0
            migrated = True

        if isinstance(legacy_messages, list):
            msgs: list[ChatMessageIn] = []
            for m in legacy_messages:
                if isinstance(m, dict):
                    msgs.append(ChatMessageIn.model_validate(m))
            msgs = msgs[-MAX_SESSION_MESSAGES:]
            cls._write_messages_file(it["message_file"], msgs)
            it["message_count"] = len(msgs)
            it.pop("messages", None)
            migrated = True

        return it, migrated

    @classmethod
    def load(cls) -> ChatSessionsFile:
        """
        Load registry and auto-migrate legacy format where session items stored ``messages`` inline.
        After migration, messages are moved to per-session files and registry records use
        ``message_file`` + ``message_count``.
        """
        path = workspace_config_path(cls.filename)
        if not path.is_file():
            return ChatSessionsFile()
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return ChatSessionsFile()
        data: Any = json.loads(raw)
        if not isinstance(data, dict):
            return ChatSessionsFile()
        items = cls._load_raw_items()
        if not items:
            return ChatSessionsFile()

        migrated = False
        new_items: list[dict[str, Any]] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            migrated_item, item_migrated = cls._migrate_item(it)
            if migrated_item is None:
                continue
            migrated = migrated or item_migrated
            new_items.append(migrated_item)

        out = ChatSessionsFile.model_validate({**data, "items": new_items})
        if migrated:
            save_workspace_config(cls.filename, out)
        return out

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
        cls._write_messages_file(rec.message_file, [])
        cls.add_item(rec)
        return rec

    @classmethod
    def list_active_items(cls) -> list[ChatSessionRecord]:
        return [item for item in cls.list_items() if item.archived_at is None]

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
        trimmed = list(messages)[-MAX_SESSION_MESSAGES:]

        def _apply(rec: ChatSessionRecord) -> None:
            if rec.archived_at is not None:
                raise ValueError("会话已归档")
            cls._write_messages_file(rec.message_file, trimmed)
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
        # Backward-compatible alias: deletion now means archiving.
        return cls.archive_session(session_id)

    @classmethod
    def get_messages(cls, session_id: str) -> list[ChatMessageIn] | None:
        rec = cls.get_active_item(session_id)
        if rec is None:
            return None
        return cls._read_messages_file(rec.message_file)


def record_to_summary(rec: ChatSessionRecord) -> ChatSessionSummaryPublic:
    return ChatSessionSummaryPublic(
        id=rec.id,
        title=rec.title,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        message_count=rec.message_count,
    )


def record_to_detail(rec: ChatSessionRecord) -> ChatSessionDetailPublic:
    return ChatSessionDetailPublic(
        id=rec.id,
        title=rec.title,
        messages=ChatSessionRegistry._read_messages_file(rec.message_file),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )
