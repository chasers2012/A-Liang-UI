from __future__ import annotations

from pathlib import Path

from factor import FactorDataSource
from workspace import get_workspace_root

from app.datasource.plugin_registry import PluginRegistry
from app.datasource.registry import DataSourceItemsRegistry


def get_datasource(id: str) -> FactorDataSource | None:
    rec = DataSourceItemsRegistry.get_item(id)
    if rec is None:
        return None
    plugin = PluginRegistry.instance().get(rec.type)
    return plugin.to_factor_datasource(dict(rec.config or {}))


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()
