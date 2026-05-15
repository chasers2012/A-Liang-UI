"""SQL 数据源作为同步写入目标时的表写入与列枚举（由 ``SqlDataSourceSpec`` 调用）。"""

from __future__ import annotations

from typing import Any

import pandas as pd
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from datasource_plugins_builtin.sql import (
    SqlColumnsConfig,
    SqlConnectionConfig,
    _quote_ident,
    build_sqlalchemy_url,
)


def _as_engine(engine: str | Engine) -> Engine:
    if isinstance(engine, Engine):
        return engine
    s = str(engine)
    if s.startswith("sqlite") and ":memory:" in s:
        return create_engine(s, connect_args={"check_same_thread": False})
    return create_engine(s)


def _nan_to_none_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in df.replace({pd.NA: None}).to_dict(orient="records"):
        rec = {k: (None if pd.isna(v) else v) for k, v in row.items()}
        out.append(rec)
    return out


def apply_column_map_to_frame(df: pd.DataFrame, column_map: dict[str, str]) -> pd.DataFrame:
    """将逻辑列名映射为目标物理列名。"""
    if not column_map:
        return df.copy()
    rename = {k: v for k, v in column_map.items() if k in df.columns and str(v).strip()}
    return df.rename(columns=rename)


def _execute_insert_loop(engine: Engine, sql: str, records: list[dict[str, Any]]) -> int:
    stmt = text(sql)
    with engine.begin() as cx:
        for rec in records:
            cx.execute(stmt, rec)
    return len(records)


def write_dataframe_to_sql_table(
    *,
    connection_config: dict[str, Any],
    columns_config: dict[str, Any],
    df: pd.DataFrame,
) -> int:
    """将 ``df`` 按 ``connection`` 中的写入选项追加插入到 SQL 表。"""
    if df.empty:
        return 0
    conn = SqlConnectionConfig.model_validate(dict(connection_config or {}))
    col = SqlColumnsConfig.model_validate(dict(columns_config or {}))
    if not conn.write_enabled:
        raise ValueError("目标数据源未开启 write_enabled，拒绝写入")

    url = build_sqlalchemy_url(conn)
    engine = _as_engine(url)
    table = conn.table.strip()
    table_sql = _quote_ident(engine, table)

    frame = apply_column_map_to_frame(df, dict(col.column_map or {}))
    db_cols = list(frame.columns)
    if not db_cols:
        return 0

    quoted_cols = [_quote_ident(engine, c) for c in db_cols]
    col_list_sql = ", ".join(quoted_cols)
    placeholders = ", ".join(f":{c}" for c in db_cols)
    records = _nan_to_none_records(frame)
    sql = f"INSERT INTO {table_sql} ({col_list_sql}) VALUES ({placeholders})"
    return _execute_insert_loop(engine, sql, records)


def list_sql_table_physical_columns(connection_config: dict[str, Any]) -> list[str]:
    conn = SqlConnectionConfig.model_validate(dict(connection_config or {}))
    url = build_sqlalchemy_url(conn)
    engine = _as_engine(url)
    table = conn.table.strip()
    insp = inspect(engine)
    schema = None
    t = table
    if "." in table:
        schema, t = table.split(".", 1)
    cols = [c.get("name") for c in insp.get_columns(t, schema=schema)]
    return [str(c) for c in cols if c]
