from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class KnowledgeDocumentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    content: str | None = None
    uploaded_path: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("name 不能为空")
        return text

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("content 不能为空")
        return text


class KnowledgeDocumentPublic(BaseModel):
    id: str
    name: str
    status: str
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int | None = Field(default=None, ge=1, le=20)
    threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    document_ids: list[str] | None = None

    @field_validator("query")
    @classmethod
    def strip_query(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("query 不能为空")
        return text


class KnowledgeSearchHit(BaseModel):
    document_name: str
    content: str
