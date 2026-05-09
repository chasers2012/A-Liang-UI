from __future__ import annotations

from app.datasource.models import DataSourceRow
from app.datasource.plugins import get_datasource_plugin, merge_datasource_config_schemas
from app.security.datasource_secrets import decrypt_secret_fields


def verify_datasource(row: DataSourceRow) -> tuple[bool, str]:
    plugin = get_datasource_plugin(row.type)
    schema = merge_datasource_config_schemas(
        plugin.get_connection_config_schema(),
        plugin.get_columns_config_schema(),
    )
    plain = decrypt_secret_fields(dict(row.config or {}), schema)
    res = plugin.verify(plain)
    return bool(res.ok), str(res.message)
