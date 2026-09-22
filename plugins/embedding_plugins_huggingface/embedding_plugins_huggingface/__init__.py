from __future__ import annotations

from typing import Any, Literal

from app.infra.embedding.plugins import EmbeddingPlugin
from app.packages.form import FormSchema
from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEmbeddings
from pydantic import BaseModel, ConfigDict, model_validator


class _HuggingFaceConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = "BAAI/bge-small-zh-v1.5"

    @model_validator(mode="after")
    def _validate(self) -> _HuggingFaceConfig:
        if not self.model.strip():
            raise ValueError("Embedding 模型不能为空")
        return self


class HuggingFaceEmbeddingPlugin(EmbeddingPlugin):
    name: Literal["huggingface"] = "huggingface"

    config = FormSchema(
        title="HuggingFace",
        description="配置本地 HuggingFace Embedding 模型。",
        json_schema={
            "type": "object",
            "properties": {
                "model": {
                    "title": "Embedding 模型",
                    "type": "string",
                    "default": "BAAI/bge-small-zh-v1.5",
                },
            },
            "required": ["model"],
        },
        ui_schema={},
    )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = _HuggingFaceConfig.model_validate(config)
        return cfg.model_dump(mode="json")

    def create_embeddings(self, settings: dict[str, Any]) -> Embeddings:
        cfg = self.validate_config(settings)
        return HuggingFaceEmbeddings(model_name=cfg["model"])


__all__ = ["HuggingFaceEmbeddingPlugin"]
