from __future__ import annotations

from typing import Any, Literal

from app.llm.plugins import LlmPlugin
from app.plugin.schema import PluginConfigSchema
from pydantic import BaseModel, ConfigDict, model_validator


class _OpenAiConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    api_key: str = ""
    base_url: str = ""

    @model_validator(mode="after")
    def _validate(self) -> _OpenAiConfig:
        if not self.api_key.strip():
            raise ValueError("API Key 不能为空")
        return self


class OpenAiLlmPlugin(LlmPlugin):
    name: Literal["openai"] = "openai"

    config = PluginConfigSchema(
        title="OpenAI",
        description="配置 OpenAI / 兼容 OpenAI 的 API。",
        json_schema={
            "type": "object",
            "properties": {
                "base_url": {"title": "API 基址（可选）", "type": "string", "default": ""},
                "api_key": {
                    "title": "API Key",
                    "type": "string",
                    "default": "",
                },
            },
            "required": ["api_key"],
        },
        ui_schema={
            "base_url": {"ui:placeholder": "默认 api.openai.com"},
            "api_key": {"ui:widget": "password", "ui:placeholder": "sk-..."},
        },
        secret_keys=["api_key"],
    )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = _OpenAiConfig.model_validate(config)
        return cfg.model_dump(mode="json")

    @staticmethod
    def _require_non_empty(settings: dict[str, Any], key: str, label: str) -> Any:
        if key not in settings:
            raise ValueError(f"OpenAI 配置缺失：{label} 为必填项")
        value = settings[key]
        if isinstance(value, str) and not value.strip():
            raise ValueError(f"OpenAI 配置缺失：{label} 为必填项")
        return value

    def to_chat_model_spec(self, settings: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        model = str(self._require_non_empty(settings, "model", "model")).strip()

        temperature = settings.get("temperature")
        cfg = self.validate_config(
            {
                "api_key": self._require_non_empty(settings, "api_key", "api_key"),
                "base_url": settings.get("base_url"),
            }
        )
        kwargs: dict[str, Any] = {
            "temperature": temperature,
            "api_key": cfg["api_key"],
        }
        base_url = str(cfg.get("base_url") or "").strip()
        if base_url:
            kwargs["base_url"] = base_url.rstrip("/")
        return f"openai:{model}", kwargs
