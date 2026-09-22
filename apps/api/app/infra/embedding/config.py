from __future__ import annotations

from typing import Any

from app.packages.config import BaseConfig
from app.packages.config.registry import get_config_spec, register_config_spec
from app.packages.config.schema import ConfigModuleSpec
from .plugins import list_embedding_plugins
from app.packages.form.schema import FormSchema


def register_embedding_settings_module() -> None:
    if get_config_spec(EmbeddingSettingsConfig.category) is not None:
        return
    json_schema, ui_schema = EmbeddingSettingsConfig.schema()
    provider_enum = ((json_schema.get("properties") or {}).get("embedding_provider") or {}).get(
        "enum"
    ) or []
    default_provider = provider_enum[0] if isinstance(provider_enum, list) and provider_enum else ""
    spec = ConfigModuleSpec(
        key=EmbeddingSettingsConfig.category,
        filename=f"{EmbeddingSettingsConfig.category}.json",
        default_values={"embedding_provider": default_provider} if default_provider else {},
        form=FormSchema(
            title=EmbeddingSettingsConfig.category_label,
            description=EmbeddingSettingsConfig.description or None,
            json_schema=json_schema,
            ui_schema=ui_schema,
        ),
    )
    register_config_spec(spec)


class EmbeddingSettingsConfig(BaseConfig):
    category = "embedding"
    category_label = "Embedding"

    @classmethod
    def schema(cls) -> tuple[dict[str, Any], dict[str, Any]]:
        plugins = list_embedding_plugins()
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
                "embedding_provider": provider_property,
                "embedding_providers": providers_property,
            },
            "required": ["embedding_provider", "embedding_providers"],
        }

        if plugins:
            schema["dependencies"] = {
                "embedding_provider": {
                    "oneOf": [
                        {
                            "properties": {
                                "embedding_provider": {"enum": [p.name]},
                                "embedding_providers": {
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
            "embedding_provider": {"ui:placeholder": ""},
            "embedding_providers": {"ui:options": {"label": False}},
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
            ui_schema["embedding_providers"][p.name] = provider_ui
        return schema, ui_schema


__all__ = [
    "EmbeddingSettingsConfig",
    "register_embedding_settings_module",
]
