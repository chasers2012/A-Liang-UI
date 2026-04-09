from __future__ import annotations

from app.datasource.plugin_registry import PluginRegistry
from app.datasource.schemas import DataSourceRecord


def verify_datasource(rec: DataSourceRecord) -> tuple[bool, str]:
    if not rec.enabled:
        return False, "数据源已禁用，请先启用后再测试。"

    plugin = PluginRegistry.instance().get(rec.type)
    res = plugin.verify(dict(rec.config or {}))
    return bool(res.ok), str(res.message)
