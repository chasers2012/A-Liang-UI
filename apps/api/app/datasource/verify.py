from __future__ import annotations

from app.datasource.models import DataSourceRow
from app.datasource.plugins import get_datasource_plugin


def verify_datasource(row: DataSourceRow) -> tuple[bool, str]:
    plugin = get_datasource_plugin(row.type)
    res = plugin.verify(dict(row.config or {}))
    return bool(res.ok), str(res.message)
