from __future__ import annotations

from typing import Any

from app.packages.config import BaseConfig
from app.packages.config.registry import get_config_spec, register_config_spec
from app.packages.config.schema import ConfigModuleSpec
from app.packages.form.schema import FormSchema
from .plugins import get_llm_plugin, list_llm_plugins


def register_llm_settings_module() -> None:
    if get_config_spec(LlmSettings.category) is not None:
        return
    json_schema, ui_schema = LlmSettings.schema()
    # IMPORTANT: config/controller merges spec.default_values at the root level.
    # Since LLM config persists *all* non-provider fields under `providers.<provider>`,
    # default_values must only include root-level keys (i.e. `provider`) to avoid
    # polluting root with model/temperature/etc defaults.
    provider_enum = ((json_schema.get("properties") or {}).get("provider") or {}).get("enum") or []
    default_provider = provider_enum[0] if isinstance(provider_enum, list) and provider_enum else ""
    spec = ConfigModuleSpec(
        key=LlmSettings.category,
        filename=f"{LlmSettings.category}.json",
        default_values={"provider": default_provider} if default_provider else {},
        form=FormSchema(
            title=LlmSettings.category_label,
            description=LlmSettings.description or None,
            json_schema=json_schema,
            ui_schema=ui_schema,
        ),
    )
    register_config_spec(spec)


class LlmSettings(BaseConfig):
    category = "llm"
    category_label = "LLM"

    @classmethod
    def schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        plugins = list_llm_plugins()
        provider_ids = [p.name for p in plugins if str(getattr(p, "name", "")).strip()]
        provider_titles = [
            (p.get_config_schema().title if p.get_config_schema() else p.name) for p in plugins
        ]
        provider_property: dict[str, Any] = {
            "title": "提供方",
            "type": "string",
        }
        if provider_ids:
            provider_property.update(
                {
                    "enum": provider_ids,
                    "enumNames": provider_titles,
                    "default": provider_ids[0],
                }
            )

        common_provider_properties: dict[str, Any] = {
            "model": {"title": "模型名", "type": "string", "default": ""},
            "temperature": {"title": "Temperature", "type": "number", "default": 1},
            "max_tool_rounds": {
                "title": "工具最大轮数",
                "type": "number",
                "default": 9999,
                "minimum": 1,
            },
        }

        providers_property: dict[str, Any] = {"type": "object", "default": {}}
        provider_buckets: dict[str, dict[str, Any]] = {}
        if plugins:
            for p in plugins:
                cfg = p.get_config_schema()
                provider_buckets[p.name] = {
                    "type": "object",
                    "properties": {
                        **common_provider_properties,
                        **((cfg.json_schema or {}).get("properties", {}) if cfg else {}),
                    },
                }

        schema: dict[str, Any] = {
            "type": "object",
            "properties": {
                "provider": provider_property,
                "providers": providers_property,
            },
            "required": ["provider", "providers"],
        }

        if plugins:
            # Require providers.<provider> depending on selected provider.
            schema["dependencies"] = {
                "provider": {
                    "oneOf": [
                        {
                            "properties": {
                                "provider": {"enum": [p.name]},
                                "providers": {
                                    "type": "object",
                                    "properties": {p.name: provider_buckets.get(p.name)},
                                    "required": [p.name],
                                },
                            },
                        }
                        for p in plugins
                    ]
                }
            }
        ui_schema: dict[str, Any] = {
            "ui:submitButtonOptions": {"norender": True},
            "provider": {"ui:placeholder": ""},
            "providers": {"ui:options": {"label": False}},
        }
        for p in plugins:
            cfg = p.get_config_schema()
            if not cfg:
                continue
            provider_ui = dict(cfg.ui_schema or {})
            provider_options = provider_ui.get("ui:options")
            if not isinstance(provider_options, dict):
                provider_options = {}
            provider_options["label"] = False
            provider_ui["ui:options"] = provider_options
            ui_schema["providers"][p.name] = provider_ui
        return schema, ui_schema


def get_llm_settings() -> tuple[str, dict[str, Any]]:
    register_llm_settings_module()
    settings = LlmSettings.get_value()
    provider_value = settings.get("provider")
    provider = str(provider_value).strip() if provider_value else ""
    if not provider:
        raise ValueError("LLM provider 未配置：请先安装并配置 LLM Provider 插件。")
    providers = settings.get("providers")
    if not isinstance(providers, dict):
        raise ValueError("LLM providers 配置缺失：请在配置中填写 providers.<provider>。")
    cfg = providers.get(provider)
    if not isinstance(cfg, dict):
        raise ValueError(f"LLM providers.{provider} 配置缺失：请完善该 provider 配置。")
    plugin = get_llm_plugin(provider)
    merged = dict(cfg)
    merged["provider"] = provider
    return plugin.to_chat_model_spec(merged)
