from __future__ import annotations

from app.datasource.plugin_registry import PluginRegistry
from app.datasource.schemas import DataSourceRecord


def verify_datasource(rec: DataSourceRecord) -> tuple[bool, str]:
    plugin = PluginRegistry.instance().get(rec.type)
    res = plugin.verify(dict(rec.config or {}))
    return bool(res.ok), str(res.message)
