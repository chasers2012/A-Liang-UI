from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KnowledgeDocumentRow(SQLModel, table=True):
    __tablename__ = "knowledge_documents"

    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    source_path: str | None = Field(default=None, index=True)
    status: str = Field(default="pending", index=True)
    error: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JsonText))
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)


class KnowledgeChunkRow(SQLModel, table=True):
    __tablename__ = "knowledge_chunks"

    id: str = Field(primary_key=True)
    document_id: str = Field(foreign_key="knowledge_documents.id", index=True)
    chunk_index: int = Field(index=True, ge=0)
    content: str
    meta: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JsonText))
    created_at: datetime = Field(default_factory=utcnow, index=True)


class KnowledgeIndexMetaRow(SQLModel, table=True):
    __tablename__ = "knowledge_index_meta"

    id: str = Field(primary_key=True)
    document_id: str = Field(
        foreign_key="knowledge_documents.id",
        unique=True,
        index=True,
    )
    chunk_count: int = Field(default=0, ge=0)
    embed_model: str = Field(default="hash-v1")
    vector_store: str = Field(default="chroma", index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)
