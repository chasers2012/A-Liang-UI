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


class KnowledgeSettings(BaseModel):
    enabled: bool = True
    top_k: int = Field(default=4, ge=1, le=20)
    threshold: float = Field(default=0.2, ge=0.0, le=1.0)
    rerank_top_n: int = Field(default=4, ge=1, le=20)
    rerank_model: str = Field(default="BAAI/bge-reranker-base")
    chunk_size: int = Field(default=800, ge=100, le=4000)
    chunk_overlap: int = Field(default=120, ge=0, le=1000)
    vector_store: str = Field(default="chroma")
    collection_name: str = Field(default="knowledge")
    embedding_provider: str = Field(default="huggingface")
    embedding_model: str = Field(default="BAAI/bge-small-zh-v1.5")
    embedding_kwargs: dict[str, Any] = Field(default_factory=lambda: {"normalize_embeddings": True})

    @field_validator("chunk_overlap")
    @classmethod
    def overlap_less_than_size(cls, value: int, info) -> int:
        chunk_size = int(info.data.get("chunk_size", 800))
        if value >= chunk_size:
            raise ValueError("chunk_overlap 必须小于 chunk_size")
        return value

    @field_validator("rerank_top_n")
    @classmethod
    def rerank_top_n_not_exceed_top_k(cls, value: int, info) -> int:
        top_k = int(info.data.get("top_k", 4))
        if value > top_k:
            raise ValueError("rerank_top_n 不能大于 top_k")
        return value

    @field_validator("embedding_provider")
    @classmethod
    def validate_embedding_provider(cls, value: str) -> str:
        text = value.strip().lower()
        if not text:
            raise ValueError("embedding_provider 不能为空")
        return text

    @field_validator("embedding_model")
    @classmethod
    def validate_embedding_model(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("embedding_model 不能为空")
        return text

    @field_validator("rerank_model")
    @classmethod
    def validate_rerank_model(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("rerank_model 不能为空")
        return text

    @classmethod
    def rjsf_schema_and_ui_schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        defaults = cls().model_dump(mode="json")
        schema: dict[str, Any] = {
            "type": "object",
            "title": "Knowledge RAG 配置",
            "properties": {
                "enabled": {
                    "type": "boolean",
                    "title": "启用知识检索",
                    "default": defaults["enabled"],
                },
                "top_k": {"type": "integer", "title": "Top K", "default": defaults["top_k"]},
                "threshold": {
                    "type": "number",
                    "title": "最小相似度阈值",
                    "default": defaults["threshold"],
                },
                "rerank_top_n": {
                    "type": "integer",
                    "title": "Rerank 保留数量",
                    "default": defaults["rerank_top_n"],
                },
                "rerank_model": {
                    "type": "string",
                    "title": "Rerank 模型",
                    "default": defaults["rerank_model"],
                },
                "chunk_size": {
                    "type": "integer",
                    "title": "切片长度",
                    "default": defaults["chunk_size"],
                },
                "chunk_overlap": {
                    "type": "integer",
                    "title": "切片重叠",
                    "default": defaults["chunk_overlap"],
                },
                "vector_store": {
                    "type": "string",
                    "title": "向量存储",
                    "default": defaults["vector_store"],
                },
                "collection_name": {
                    "type": "string",
                    "title": "集合名称",
                    "default": defaults["collection_name"],
                },
                "embedding_provider": {
                    "type": "string",
                    "title": "Embedding 提供方",
                    "default": defaults["embedding_provider"],
                },
                "embedding_model": {
                    "type": "string",
                    "title": "Embedding 模型",
                    "default": defaults["embedding_model"],
                },
                "embedding_kwargs": {
                    "type": "object",
                    "title": "Embedding 参数",
                    "default": defaults["embedding_kwargs"],
                },
            },
            "required": ["enabled", "top_k", "threshold", "chunk_size", "chunk_overlap"],
        }
        ui_schema: dict[str, Any] = {"ui:submitButtonOptions": {"norender": True}}
        return schema, ui_schema
