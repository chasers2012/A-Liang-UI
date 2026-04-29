from typing import Any

from app.config import BaseConfig


def register_llm_settings_module() -> None:
    LlmSettings.register()


class LlmSettings(BaseConfig):
    category = "llm"
    category_label = "LLM"

    @classmethod
    def schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        schema: dict[str, Any] = {
            "type": "object",
            "properties": {
                "provider": {
                    "title": "提供方",
                    "type": "string",
                    "enum": ["ollama", "openai"],
                    "enumNames": ["Ollama（本地）", "OpenAI"],
                    "default": "ollama",
                },
                "model": {
                    "title": "模型名",
                    "type": "string",
                    "default": "qwen3.5:9b",
                },
                "temperature": {
                    "title": "Temperature",
                    "type": "number",
                    "default": 1,
                },
                "max_tool_rounds": {
                    "title": "工具最大轮数",
                    "type": "number",
                    "default": 9999,
                    "minimum": 1,
                },
            },
            "required": ["provider", "model", "temperature", "max_tool_rounds"],
            "dependencies": {
                "provider": {
                    "oneOf": [
                        {
                            "properties": {
                                "provider": {"enum": ["ollama"]},
                                "ollama_base_url": {
                                    "title": "Ollama 地址",
                                    "type": "string",
                                    "default": "http://127.0.0.1:11434",
                                },
                                "ollama_timeout": {
                                    "title": "Ollama 超时时间（秒）",
                                    "type": "number",
                                    "default": 600,
                                },
                                "ollama_reasoning": {
                                    "title": "Ollama reasoning",
                                    "type": "boolean",
                                    "default": True,
                                },
                            },
                            "required": [
                                "ollama_base_url",
                                "ollama_timeout",
                                "ollama_num_predict",
                            ],
                        },
                        {
                            "properties": {
                                "provider": {"enum": ["openai"]},
                                "openai_base_url": {
                                    "title": "OpenAI API 基址（可选）",
                                    "type": "string",
                                    "default": "",
                                },
                                "api_key": {
                                    "title": "API Key",
                                    "type": "string",
                                    "default": "",
                                },
                            },
                        },
                    ]
                }
            },
        }
        ui_schema: dict[str, Any] = {
            "ui:submitButtonOptions": {"norender": True},
            "model": {"ui:placeholder": "qwen3.5:9b"},
            "ollama_base_url": {"ui:placeholder": "http://127.0.0.1:11434"},
            "openai_base_url": {"ui:placeholder": "默认 api.openai.com"},
            "api_key": {"ui:widget": "password", "ui:placeholder": "sk-..."},
            "ollama_reasoning": {"ui:help": ""},
        }
        return schema, ui_schema


def get_llm_settings() -> tuple[str, dict[str, Any]]:
    settings = LlmSettings.get_value()
    temperature = settings.get("tempreature")
    provider_value = settings.get("provider")
    provider = provider_value if provider_value in ("ollama", "openai") else "ollama"
    model_value = settings.get("model")
    model = model_value.strip() if model_value else "qwen3.5:9b"

    if provider == "openai":
        api_key = (settings.get("api_key") or "").strip() or None
        if not api_key:
            raise ValueError(
                "OpenAI 提供方需要 API 密钥：在 Web Agent 页面保存 api_key"
                "（写入 config/agent/llm.json）。"
            )
        openai_kwargs: dict[str, Any] = {
            "temperature": temperature,
            "api_key": api_key,
        }
        ob = (settings.get("openai_base_url") or "").strip()
        if ob:
            openai_kwargs["base_url"] = ob.rstrip("/")
        return f"openai:{model}", openai_kwargs

    timeout = settings.get("ollama_timeout")
    base_url = (settings.get("ollama_base_url") or "").strip()
    reasoning = settings.get("ollama_reasoning")

    client_kwargs: dict[str, Any] = {"timeout": timeout}
    kwargs: dict[str, Any] = {
        "temperature": temperature,
        "base_url": base_url.rstrip("/"),
        "client_kwargs": client_kwargs,
    }
    if reasoning is not None:
        kwargs["reasoning"] = reasoning
    return f"ollama:{model}", kwargs
