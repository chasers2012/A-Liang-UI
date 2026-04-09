from __future__ import annotations

from pathlib import Path

from factor import FactorDataSource
from workspace import get_workspace_root

from app.datasource.plugin_registry import PluginRegistry
from app.datasource.registry import DataSourceItemsRegistry


class BoundFactorDataSource(FactorDataSource):
    """Attach datasource id for downstream cross-source preprocessing."""

    def __init__(self, datasource_id: str, inner: FactorDataSource) -> None:
        self.id = str(datasource_id)
        self._inner = inner

    def list_columns(self) -> list[str]:
        return self._inner.list_columns()

    def load_frame(self, *, columns: list[str], filters=None):  # type: ignore[no-untyped-def]
        return self._inner.load_frame(columns=columns, filters=filters)


def get_datasource(id: str) -> FactorDataSource | None:
    rec = DataSourceItemsRegistry.get_item(id)
    if rec is None:
        return None
    plugin = PluginRegistry.instance().get(rec.type)
    ds = plugin.to_factor_datasource(dict(rec.config or {}))
    return BoundFactorDataSource(id, ds)


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()
