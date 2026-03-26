from __future__ import annotations

import re

from sqlalchemy import create_engine, inspect

from app.datasources.schemas import SqlConfigStored, SqlTableColumnsRequest
from app.datasources.sql_url import build_sqlalchemy_url

_SAFE_TABLE_RE = re.compile(r"^[A-Za-z0-9_.]+$")


def assert_safe_table_qualifier(table: str) -> None:
    t = table.strip()
    if not t:
        raise ValueError("表名不能为空")
    if not _SAFE_TABLE_RE.match(t):
        raise ValueError("表名仅允许字母、数字、下划线与点号")
    for part in t.split("."):
        if not part:
            raise ValueError("表名格式无效")


def _parse_table_name(table: str) -> tuple[str | None, str]:
    t = table.strip()
    if "." in t:
        a, b = t.split(".", 1)
        sch = a.strip() or None
        name = b.strip()
        if not name:
            raise ValueError("表名格式无效")
        return sch, name
    return None, t


def sql_config_for_column_listing(
    body: SqlTableColumnsRequest,
    stored: SqlConfigStored | None,
) -> SqlConfigStored:
    """Build config for introspection: overlay form fields on saved record when given."""
    if stored is not None:
        d = stored.model_dump()
        if body.db_driver.strip():
            d["db_driver"] = body.db_driver.strip()
        if body.db_host.strip():
            d["db_host"] = body.db_host.strip()
        if body.db_name.strip():
            d["db_name"] = body.db_name.strip()
        if body.db_username.strip():
            d["db_username"] = body.db_username.strip()
        if body.db_password.strip():
            d["db_password"] = body.db_password.strip()
        if body.db_port is not None:
            d["db_port"] = body.db_port
        d["table"] = body.table.strip()
        return SqlConfigStored(**d)
    table = body.table.strip()
    if not table:
        raise ValueError("请填写表名")
    if not body.db_host.strip() or not body.db_name.strip():
        raise ValueError("请填写主机（IP）与数据库名")
    return SqlConfigStored(
        engine_url=None,
        db_driver=body.db_driver.strip() or "postgresql",
        db_host=body.db_host.strip(),
        db_port=body.db_port,
        db_username=body.db_username.strip(),
        db_password=body.db_password.strip(),
        db_name=body.db_name.strip(),
        table=table,
        date_column="_",
        asset_column="_",
        column_map={},
    )


def list_table_column_names(sql: SqlConfigStored) -> list[str]:
    """Return ordered column names for ``sql.table`` (optional schema prefix)."""
    assert_safe_table_qualifier(sql.table)
    url = build_sqlalchemy_url(sql)
    if not url:
        raise ValueError("无法建立数据库连接：请填写主机、库名等信息，或保留有效连接串")
    schema, tbl = _parse_table_name(sql.table)
    engine = create_engine(url)
    insp = inspect(engine)
    try:
        cols = insp.get_columns(tbl, schema=schema)
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"无法读取表列: {e}") from e
    return [str(c["name"]) for c in cols]
