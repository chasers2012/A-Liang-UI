from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict

from app.workspace_config import load_workspace_config, save_workspace_config

from .registry import get_config_spec, list_config_specs
from .schema import ConfigModuleSpec, ConfigModuleSpecPublic


class GenericConfigValues(BaseModel):
    model_config = ConfigDict(extra="allow")


def _require_spec(module_key: str) -> ConfigModuleSpec:
    spec = get_config_spec(module_key)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"unknown config module: {module_key}")
    return spec


def _merge_with_defaults(spec: ConfigModuleSpec, incoming: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(spec.default_values)
    merged.update(dict(incoming or {}))
    return merged


def list_specs() -> list[ConfigModuleSpecPublic]:
    return [
        ConfigModuleSpecPublic(
            key=spec.key,
            title=spec.form.title,
            description=spec.form.description,
            json_schema=spec.form.json_schema,
            ui_schema=spec.form.ui_schema,
        )
        for spec in list_config_specs()
    ]


def get_module_config(module_key: str, *, redact_secrets: bool = False) -> dict[str, Any]:
    spec = _require_spec(module_key)
    data_model = load_workspace_config(
        spec.filename,
        GenericConfigValues,
        default_factory=GenericConfigValues,
    )
    merged = _merge_with_defaults(spec, data_model.model_dump())
    if redact_secrets:
        return spec.form.redact(merged)
    return merged


def put_module_config(
    module_key: str,
    incoming: dict[str, Any],
    *,
    redact_response: bool = True,
) -> dict[str, Any]:
    spec = _require_spec(module_key)
    cleaned = _merge_with_defaults(spec, incoming)
    save_workspace_config(spec.filename, GenericConfigValues.model_validate(cleaned))
    if redact_response:
        return spec.form.redact(cleaned)
    return cleaned
