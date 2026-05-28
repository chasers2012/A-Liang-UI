from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any


@dataclass(frozen=True, slots=True)
class LoaderSpec:
    key: str
    label: str
    loader: Callable[..., Any]
    config: dict[str, Any]
    columns: tuple[str, ...] | list[str]
    date_column: str
    asset_column: str | None = None


@dataclass(frozen=True, slots=True)
class ApiCatalog:
    keys: tuple[str, ...]
    options: tuple[dict[str, str], ...]
    config_schemas: MappingProxyType[str, dict[str, Any]]
    loaders: MappingProxyType[str, Callable[..., Any]]
    fixed_columns: MappingProxyType[str, tuple[str, ...]]
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


def build_api_catalog(api_specs: Iterable[LoaderSpec]) -> ApiCatalog:
    keys: list[str] = []
    options: list[dict[str, str]] = []
    config_schemas: dict[str, dict[str, Any]] = {}
    loaders: dict[str, Callable[..., Any]] = {}
    fixed_columns: dict[str, tuple[str, ...]] = {}
    default_date_columns: dict[str, str] = {}
    default_asset_columns: dict[str, str | None] = {}
    for spec in api_specs:
        key = spec.key.strip()
        if not key:
            continue
        if spec.label:
            keys.append(key)
            options.append({"const": key, "title": spec.label})
        config_schemas[key] = dict(spec.config)
        loaders[key] = spec.loader
        fixed_columns[key] = tuple(str(c) for c in spec.columns)
        default_date_columns[key] = spec.date_column
        asset_raw = spec.asset_column
        default_asset_columns[key] = (
            (str(asset_raw).strip() or None) if asset_raw is not None else None
        )
    return ApiCatalog(
        keys=tuple(keys),
        options=tuple(options),
        config_schemas=MappingProxyType(config_schemas),
        loaders=MappingProxyType(loaders),
        fixed_columns=MappingProxyType(fixed_columns),
        default_date_columns=MappingProxyType(default_date_columns),
        default_asset_columns=MappingProxyType(default_asset_columns),
    )
