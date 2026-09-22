from __future__ import annotations

import logging
from typing import Any, Literal

from app.infra.embedding.plugins import EmbeddingPlugin
from app.packages.form import FormSchema
from langchain_core.embeddings import Embeddings
from langchain_openai import OpenAIEmbeddings
from pydantic import BaseModel, ConfigDict, model_validator

logger = logging.getLogger(__name__)


class _OpenAiConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = "text-embedding-3-small"
    base_url: str = ""
    api_key: str = ""
    dimensions: int | None = None
    chunk_size: int | None = None

    @model_validator(mode="after")
    def _validate(self) -> _OpenAiConfig:
        if not self.model.strip():
            raise ValueError("Embedding 模型不能为空")
        if not self.api_key.strip():
            raise ValueError("Embedding API Key 不能为空")
        model_lower = self.model.strip().lower()
        if self.dimensions is not None and "doubao-embedding" in model_lower:
            allowed = {1024, 2048}
            if self.dimensions not in allowed:
                raise ValueError(
                    f"模型 {self.model!r} 的 dimensions 仅支持 {sorted(allowed)}，当前为 {self.dimensions}"
                )
        return self


class OpenAiEmbeddingPlugin(EmbeddingPlugin):
    name: Literal["openai"] = "openai"

    config = FormSchema(
        title="OpenAI",
        description="配置 OpenAI 或 OpenAI 兼容的 Embedding API。",
        json_schema={
            "type": "object",
            "properties": {
                "model": {
                    "title": "Embedding 模型",
                    "type": "string",
                    "default": "text-embedding-3-small",
                },
                "base_url": {
                    "title": "Embedding API Base URL",
                    "type": "string",
                    "description": "OpenAI 兼容 base_url，例如 https://api.openai.com/v1 或服务商兼容地址。",
                    "default": "",
                },
                "api_key": {
                    "title": "Embedding API Key",
                    "type": "string",
                    "default": "",
                },
                "dimensions": {
                    "title": "Embedding 维度",
                    "type": "integer",
                    "description": "仅部分模型支持（如 OpenAI text-embedding-3-*、豆包 doubao-embedding 系列）。豆包常见取值为 1024 或 2048；留空表示使用模型默认维度。",
                },
                "chunk_size": {
                    "title": "批量大小",
                    "type": "integer",
                    "description": "单次发送给 Embedding API 的文本片段数量。",
                    "default": 10,
                },
            },
            "required": ["model", "api_key"],
        },
        ui_schema={"api_key": {"ui:widget": "password", "ui:placeholder": "sk-..."}},
    )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = _OpenAiConfig.model_validate(config)
        return cfg.model_dump(mode="json")

    def create_embeddings(self, settings: dict[str, Any]) -> Embeddings:
        cfg = self.validate_config(settings)
        kwargs: dict[str, Any] = {
            "model": cfg["model"],
            "api_key": cfg["api_key"],
        }
        base_url = str(cfg.get("base_url") or "").strip()
        if base_url:
            kwargs["base_url"] = base_url.rstrip("/")
        dimensions = cfg.get("dimensions")
        if dimensions:
            kwargs["dimensions"] = dimensions
        chunk_size = cfg.get("chunk_size")
        if isinstance(chunk_size, int) and chunk_size > 0:
            kwargs["chunk_size"] = chunk_size
        # Keep LangChain from doing length-safe tokenization, which can trigger
        # HuggingFace tokenizer downloads when `tiktoken_enabled=False`.
        # We want the raw text to go directly to the OpenAI-compatible endpoint.
        kwargs["check_embedding_ctx_length"] = False
        logger.info(
            "创建 OpenAIEmbeddings：model=%s base_url=%s dimensions=%s chunk_size=%s check_embedding_ctx_length=%s",
            kwargs.get("model"),
            kwargs.get("base_url", ""),
            kwargs.get("dimensions"),
            kwargs.get("chunk_size"),
            kwargs.get("check_embedding_ctx_length"),
        )
        return OpenAIEmbeddings(**kwargs)


__all__ = ["OpenAiEmbeddingPlugin"]
