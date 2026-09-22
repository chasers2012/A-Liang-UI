from __future__ import annotations

from typing import Any

from sqlmodel import Column, Field, Index, SQLModel

from app.infra.persistence.sql_types import JsonText


class ChatRow(SQLModel, table=True):
    __tablename__ = "chats"

    id: str = Field(primary_key=True)
    title: str
    message_count: int = 0
    created_at: str
    updated_at: str
    archived_at: str | None = None


class ChatMessageRow(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: str = Field(primary_key=True)
    session_id: str = Field(index=True)
    role: str
    blocks: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JsonText))
    created_at: str | None = Field(default=None, index=True)


Index("ix_chat_messages_session_created", ChatMessageRow.session_id, ChatMessageRow.created_at)
