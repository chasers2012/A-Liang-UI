from __future__ import annotations

from typing import Any, Literal

from app.infra.form import FormSchema
from app.infra.rerank.plugins import RerankPlugin
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from pydantic import BaseModel, ConfigDict, model_validator


class _HuggingFaceConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = "BAAI/bge-reranker-base"

    @model_validator(mode="after")
    def _validate(self) -> _HuggingFaceConfig:
        if not self.model.strip():
            raise ValueError("Rerank 模型不能为空")
        return self


class HuggingFaceRerankPlugin(RerankPlugin):
    name: Literal["huggingface"] = "huggingface"

    config = FormSchema(
        title="HuggingFace",
        description="配置本地 HuggingFace Cross-Encoder Rerank 模型。",
        json_schema={
            "type": "object",
            "properties": {
                "model": {
                    "title": "Rerank 模型",
                    "type": "string",
                    "default": "BAAI/bge-reranker-base",
                },
            },
            "required": ["model"],
        },
        ui_schema={},
    )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = _HuggingFaceConfig.model_validate(config)
        return cfg.model_dump(mode="json")

    def create_reranker(self, settings: dict[str, Any], *, top_n: int) -> CrossEncoderReranker:
        cfg = self.validate_config(settings)
        model = HuggingFaceCrossEncoder(model_name=cfg["model"])
        return CrossEncoderReranker(model=model, top_n=top_n)


__all__ = ["HuggingFaceRerankPlugin"]
