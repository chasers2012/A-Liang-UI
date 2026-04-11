from __future__ import annotations

from app.datasource.plugins import get_datasource_plugin
from app.datasource.schemas import DataSourceRecord


def verify_datasource(rec: DataSourceRecord) -> tuple[bool, str]:
    plugin = get_datasource_plugin(rec.type)
    res = plugin.verify(dict(rec.config or {}))
    return bool(res.ok), str(res.message)
