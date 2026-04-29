from __future__ import annotations

from contextlib import suppress
from typing import Any

from app.config import BaseConfig


def register_knowledge_settings_module() -> None:
    with suppress(ValueError):
        KnowledgeRagSettings.register()


KnowledgeSettings = dict[str, Any]

DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettings = {
    "enabled": True,
    "top_k": 4,
    "threshold": 0.2,
    "rerank_top_n": 4,
    "rerank_model": "BAAI/bge-reranker-base",
    "chunk_size": 800,
    "chunk_overlap": 120,
    "vector_store": "chroma",
    "collection_name": "knowledge",
    "embedding_provider": "huggingface",
    "embedding_model": "BAAI/bge-small-zh-v1.5",
    "embedding_kwargs": {"normalize_embeddings": True},
}


class KnowledgeRagSettings(BaseConfig):
    category = "knowledge_rag"
    category_label = "知识库检索"
    description = "配置 Chat RAG 检索参数。"

    @classmethod
    def schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        defaults = dict(DEFAULT_KNOWLEDGE_SETTINGS)
        schema: dict[str, Any] = {
            "type": "object",
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


def get_knowledge_settings() -> KnowledgeSettings:
    return KnowledgeRagSettings.get_value()
