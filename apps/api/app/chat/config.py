from contextlib import suppress
from typing import Any

from app.chat.schemas import LlmSettings
from app.config import controller as config_controller
from app.config import register_config_spec
from app.config.schema import ConfigModuleSpec

_LLM_CONFIG_MODULE = "agent_llm"


def register_llm_settings_module() -> None:
    defaults = LlmSettings().model_dump(mode="json")
    rjsf_schema, rjsf_ui_schema = LlmSettings.rjsf_schema_and_ui_schema()
    spec = ConfigModuleSpec(
        key=_LLM_CONFIG_MODULE,
        title="模型与密钥",
        description="配置因子挖掘智能体使用的 LLM。",
        filename="chat/llm.json",
        default_values=defaults,
        json_schema=rjsf_schema,
        ui_schema=rjsf_ui_schema,
    )
    # Module reload may execute this file repeatedly in dev mode.
    with suppress(ValueError):
        register_config_spec(spec)


def get_llm_settings() -> LlmSettings:
    values = config_controller.get_module_config(_LLM_CONFIG_MODULE)
    settings = LlmSettings.model_validate(values)
    temperature = settings.temperature
    provider = settings.provider if settings.provider in ("ollama", "openai") else "ollama"
    model = settings.model.strip() if settings.model else "qwen3.5:9b"

    if provider == "openai":
        api_key = (settings.api_key or "").strip() or None
        if not api_key:
            raise ValueError(
                "OpenAI 提供方需要 API 密钥：在 Web Agent 页面保存 api_key"
                "（写入 config/agent/llm.json）。"
            )
        openai_kwargs: dict[str, Any] = {
            "temperature": temperature,
            "api_key": api_key,
        }
        ob = (settings.openai_base_url or "").strip()
        if ob:
            openai_kwargs["base_url"] = ob.rstrip("/")
        return f"openai:{model}", openai_kwargs

    timeout = settings.ollama_timeout
    num_predict = settings.ollama_num_predict
    base_url = (settings.ollama_base_url or "").strip()
    reasoning = settings.ollama_reasoning

    client_kwargs: dict[str, Any] = {"timeout": timeout}
    kwargs: dict[str, Any] = {
        "temperature": temperature,
        "base_url": base_url.rstrip("/"),
        "num_predict": num_predict,
        "client_kwargs": client_kwargs,
    }
    if reasoning is not None:
        kwargs["reasoning"] = reasoning
    return f"ollama:{model}", kwargs
