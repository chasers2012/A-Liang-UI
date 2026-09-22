from __future__ import annotations

from contextlib import suppress
from typing import Any

from app.packages.config import BaseConfig


def register_knowledge_settings_module() -> None:
    with suppress(ValueError):
        KnowledgeRagSettings.register()


KnowledgeSettings = dict[str, Any]


class KnowledgeRagSettings(BaseConfig):
    category = "knowledge_rag"
    category_label = "知识库检索"
    description = "配置 Chat RAG 检索参数。"

    @classmethod
    def schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        schema: dict[str, Any] = {
            "type": "object",
            "properties": {
                "enabled": {
                    "type": "boolean",
                    "title": "启用知识检索",
                    "default": True,
                },
                "top_k": {"type": "integer", "title": "Top K", "default": 4},
                "threshold": {
                    "type": "number",
                    "title": "最小相似度阈值",
                    "default": 0.2,
                },
                "rerank_top_n": {
                    "type": "integer",
                    "title": "Rerank 保留数量",
                    "default": 4,
                },
            },
            "required": ["enabled", "top_k", "threshold"],
        }
        ui_schema: dict[str, Any] = {"ui:submitButtonOptions": {"norender": True}}
        return schema, ui_schema


def get_knowledge_settings() -> KnowledgeSettings:
    return KnowledgeRagSettings.get_value()
