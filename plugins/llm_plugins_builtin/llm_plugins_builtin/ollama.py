from __future__ import annotations

from typing import Any, Literal

from app.form import FormSchema
from app.llm.plugins import LlmPlugin
from pydantic import BaseModel, ConfigDict


class _OllamaConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_url: str = "http://127.0.0.1:11434"
    timeout: float = 600
    reasoning: bool = True


class OllamaLlmPlugin(LlmPlugin):
    name: Literal["ollama"] = "ollama"

    config = FormSchema(
        title="Ollama",
        description="使用本地 Ollama 服务。",
        json_schema={
            "type": "object",
            "properties": {
                "base_url": {
                    "title": "服务地址",
                    "type": "string",
                    "default": "http://127.0.0.1:11434",
                },
                "timeout": {"title": "超时时间（秒）", "type": "number", "default": 600},
                "reasoning": {"title": "Reasoning", "type": "boolean", "default": True},
            },
            "required": ["base_url", "timeout"],
        },
        ui_schema={
            "base_url": {"ui:placeholder": "http://127.0.0.1:11434"},
            "reasoning": {"ui:help": ""},
        },
    )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = _OllamaConfig.model_validate(config)
        return cfg.model_dump(mode="json")

    @staticmethod
    def _require_non_empty(settings: dict[str, Any], key: str, label: str) -> Any:
        if key not in settings:
            raise ValueError(f"Ollama 配置缺失：{label} 为必填项")
        value = settings[key]
        if isinstance(value, str) and not value.strip():
            raise ValueError(f"Ollama 配置缺失：{label} 为必填项")
        return value

    def to_chat_model_spec(self, settings: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        model = str(self._require_non_empty(settings, "model", "model")).strip()

        temperature = settings.get("temperature")
        cfg = self.validate_config(
            {
                "base_url": self._require_non_empty(settings, "base_url", "base_url"),
                "timeout": self._require_non_empty(settings, "timeout", "timeout"),
                "reasoning": settings.get("reasoning"),
            }
        )

        client_kwargs: dict[str, Any] = {"timeout": cfg.get("timeout")}
        kwargs: dict[str, Any] = {
            "temperature": temperature,
            "base_url": str(cfg.get("base_url") or "").rstrip("/"),
            "client_kwargs": client_kwargs,
            "reasoning": bool(cfg.get("reasoning")),
        }
        return f"ollama:{model}", kwargs
