from __future__ import annotations

from typing import Any

from app.infra.form.schema import FormSchema
from app.infra.rerank.plugins import list_rerank_plugins
from app.packages.config.base import BaseConfig
from app.packages.config.registry import get_config_spec, register_config_spec
from app.packages.config.schema import ConfigModuleSpec


def register_rerank_settings_module() -> None:
    if get_config_spec(RerankSettingsConfig.category) is not None:
        return
    json_schema, ui_schema = RerankSettingsConfig.schema()
    provider_enum = ((json_schema.get("properties") or {}).get("rerank_provider") or {}).get(
        "enum"
    ) or []
    default_provider = provider_enum[0] if isinstance(provider_enum, list) and provider_enum else ""
    spec = ConfigModuleSpec(
        key=RerankSettingsConfig.category,
        filename=f"{RerankSettingsConfig.category}.json",
        default_values={"rerank_provider": default_provider} if default_provider else {},
        form=FormSchema(
            title=RerankSettingsConfig.category_label,
            description=RerankSettingsConfig.description or None,
            json_schema=json_schema,
            ui_schema=ui_schema,
        ),
    )
    register_config_spec(spec)


class RerankSettingsConfig(BaseConfig):
    category = "rerank"
    category_label = "Rerank"
    description = "配置知识库检索使用的 Rerank 模型提供方。"

    @classmethod
    def schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        plugins = list_rerank_plugins()
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

        providers_property: dict[str, Any] = {"type": "object", "default": {}}
        provider_buckets: dict[str, dict[str, Any]] = {}
        if plugins:
            for p in plugins:
                cfg = p.get_config_schema()
                provider_buckets[p.name] = {
                    "type": "object",
                    "properties": ((cfg.json_schema or {}).get("properties", {}) if cfg else {}),
                }

        schema: dict[str, Any] = {
            "type": "object",
            "properties": {
                "rerank_provider": provider_property,
                "rerank_providers": providers_property,
            },
            "required": ["rerank_provider", "rerank_providers"],
        }

        if plugins:
            schema["dependencies"] = {
                "rerank_provider": {
                    "oneOf": [
                        {
                            "properties": {
                                "rerank_provider": {"enum": [p.name]},
                                "rerank_providers": {
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
            "rerank_provider": {"ui:placeholder": ""},
            "rerank_providers": {"ui:options": {"label": False}},
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
            ui_schema["rerank_providers"][p.name] = provider_ui
        return schema, ui_schema


__all__ = [
    "RerankSettingsConfig",
    "register_rerank_settings_module",
]
