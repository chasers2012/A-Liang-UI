from __future__ import annotations

from factor import FactorDataSource

from app.datasource.registry import DataSourceItemsRegistry
from app.plugin import PluginRegistry


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
