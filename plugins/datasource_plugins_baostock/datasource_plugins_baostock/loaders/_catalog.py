from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any


@dataclass(frozen=True, slots=True)
class ApiCatalog:
    keys: tuple[str, ...]
    options: tuple[dict[str, str], ...]
    config_schemas: MappingProxyType[str, dict[str, Any]]
    loaders: MappingProxyType[str, Callable[..., Any]]
    fixed_columns: MappingProxyType[str, tuple[str, ...]]
    columns_for_config: MappingProxyType[str, Callable[..., list[str]]]
    default_date_columns: MappingProxyType[str, str]
    default_asset_columns: MappingProxyType[str, str | None]

    @property
    def default_api_name(self) -> str:
        return self.keys[0] if self.keys else ""

    @property
    def default_date_column(self) -> str:
        return self.default_date_columns.get(self.default_api_name, "date")

    @property
    def default_asset_column(self) -> str | None:
        if not self.default_api_name:
            return "code"
        return self.default_asset_columns.get(self.default_api_name)


def build_api_catalog(api_specs: Iterable[Mapping[str, Any]]) -> ApiCatalog:
    keys: list[str] = []
    options: list[dict[str, str]] = []
    config_schemas: dict[str, dict[str, Any]] = {}
    loaders: dict[str, Callable[..., Any]] = {}
    fixed_columns: dict[str, tuple[str, ...]] = {}
    columns_for_config: dict[str, Callable[..., list[str]]] = {}
    default_date_columns: dict[str, str] = {}
    default_asset_columns: dict[str, str | None] = {}
    for api in api_specs:
        key = str(api.get("key") or "").strip()
        if not key:
            continue
        label = api.get("label")
        if label:
            keys.append(key)
            options.append({"const": key, "title": str(label)})
        config_schemas[key] = dict(api.get("config") or {})
        loader = api.get("loader")
        if callable(loader):
            loaders[key] = loader
        fixed_columns[key] = tuple(str(c) for c in (api.get("columns") or []))
        resolver = api.get("columns_for_config")
        if callable(resolver):
            columns_for_config[key] = resolver
        default_date_columns[key] = str(api.get("date_column") or "")
        asset_raw = api.get("asset_column")
        default_asset_columns[key] = (
            (str(asset_raw).strip() or None) if asset_raw is not None else None
        )
    return ApiCatalog(
        keys=tuple(keys),
        options=tuple(options),
        config_schemas=MappingProxyType(config_schemas),
        loaders=MappingProxyType(loaders),
        fixed_columns=MappingProxyType(fixed_columns),
        columns_for_config=MappingProxyType(columns_for_config),
        default_date_columns=MappingProxyType(default_date_columns),
        default_asset_columns=MappingProxyType(default_asset_columns),
    )
