"""DuckDB-backed DataSource base (CSV/SQL plugins only; not exported)."""

from __future__ import annotations

from abc import abstractmethod
from contextlib import suppress
from importlib.resources import as_file, files
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd
from data_source import DataSource
from pydantic import BaseModel, ConfigDict, Field, model_validator

_INCOMING_VIEW = "_qa_incoming_df"
_NEW_ROWS_VIEW = "_qa_new_rows"


def quote_ident(name: str) -> str:
    return '"' + str(name).replace('"', '""') + '"'


def quote_literal(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def duckdb_path(path_like: Any) -> str:
    return str(path_like).replace("\\", "/")


# Filenames produced by ``bundle_duckdb_extensions.py`` at wheel build time.
_BUNDLED_EXTENSION_ARTIFACTS: dict[str, str] = {
    "postgres": "postgres_scanner.duckdb_extension",
    "mysql": "mysql_scanner.duckdb_extension",
}


def _bundled_extension_resource(driver: str) -> Path:
    artifact = _BUNDLED_EXTENSION_ARTIFACTS.get(driver)
    if artifact is None:
        raise RuntimeError(f"未配置 DuckDB 扩展打包映射: {driver!r}")
    resource = files("datasource_plugins_builtin") / "_bundled_extensions" / artifact
    if not resource.is_file():
        raise RuntimeError(
            f"缺少打包的 DuckDB 扩展 {artifact!r}（请重新构建/安装 datasource-plugins-builtin，"
            "构建时会执行 bundle_duckdb_extensions）"
        )
    with as_file(resource) as path:
        return Path(path)


def _load_duckdb_extension(con: duckdb.DuckDBPyConnection, driver: str) -> None:
    path = _bundled_extension_resource(driver)
    try:
        con.execute(f"LOAD {quote_literal(duckdb_path(path))}")
    except duckdb.Error as e:
        raise RuntimeError(f"DuckDB 扩展 {driver!r} 加载失败: {e}") from e


def duckdb_load_and_attach(
    con: duckdb.DuckDBPyConnection,
    *,
    driver: str,
    dsn: str,
    catalog: str = "remote",
    read_only: bool,
) -> None:
    _load_duckdb_extension(con, driver)
    opts = f"TYPE {driver}"
    if read_only:
        opts += ", READ_ONLY"
    con.execute(f"ATTACH {quote_literal(dsn)} AS {quote_ident(catalog)} ({opts})")


class DatasourceWriteConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    write_enabled: bool = False


class DatasourceColumnsConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    date_column: str = "date"
    asset_column: str | None = "asset"
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _normalize_columns(self) -> DatasourceColumnsConfig:
        date_col = str(self.date_column).strip()
        if not date_col:
            raise ValueError("date_column 不能为空")
        self.date_column = date_col
        if self.asset_column is not None:
            self.asset_column = str(self.asset_column).strip() or None
        self.columns = [str(c).strip() for c in self.columns if str(c).strip()]
        return self


class DuckDbDataSource(DataSource):
    def __init__(
        self,
        *,
        date_column: str = "date",
        asset_column: str | None = "asset",
        write_enabled: bool = False,
    ) -> None:
        date_col = str(date_column).strip()
        if not date_col:
            raise ValueError("date_column 不能为空")
        self._date_column = date_col
        self._asset_column = str(asset_column).strip() or None if asset_column is not None else None
        self._write_enabled = bool(write_enabled)
        self._con: duckdb.DuckDBPyConnection | None = None

    @property
    def date_column(self) -> str:
        return self._date_column

    @property
    def asset_column(self) -> str | None:
        return self._asset_column

    def _db(self) -> duckdb.DuckDBPyConnection:
        if self._con is None:
            self._con = duckdb.connect(":memory:")
            self._prepare(self._con)
        return self._con

    @abstractmethod
    def _prepare(self, con: duckdb.DuckDBPyConnection) -> None:
        raise NotImplementedError

    _rel: str

    @abstractmethod
    def _persist_new_rows(
        self,
        con: duckdb.DuckDBPyConnection,
        new_rows_view: str,
        incoming_columns: list[str],
        new_row_count: int,
    ) -> int:
        raise NotImplementedError

    def list_columns(self) -> list[str]:
        con = self._db()
        rel = self._rel
        rows = con.execute(f"DESCRIBE SELECT * FROM {rel}").fetchall()
        cols = [str(r[0]) for r in rows if r and r[0] is not None]
        return sorted(set(cols), key=lambda x: (x.lower(), x))

    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        cols = [str(c) for c in columns]
        if not cols:
            return pd.DataFrame()

        con = self._db()
        rel = self._rel
        select_sql = ", ".join(quote_ident(c) for c in cols)
        where_parts: list[str] = []
        params: list[Any] = []

        dc = quote_ident(self._date_column)
        if start_date is not None:
            where_parts.append(f"{dc} >= ?")
            params.append(str(start_date))
        if end_date is not None:
            where_parts.append(f"{dc} <= ?")
            params.append(str(end_date))
        if asset_values is not None:
            if self._asset_column is None:
                raise ValueError("asset_values 过滤需要 asset_column")
            if not asset_values:
                where_parts.append("1 = 0")
            else:
                placeholders = ", ".join(["?"] * len(asset_values))
                where_parts.append(f"{quote_ident(self._asset_column)} IN ({placeholders})")
                params.extend(str(v) for v in asset_values)

        sql = f"SELECT {select_sql} FROM {rel}"
        if where_parts:
            sql += " WHERE " + " AND ".join(where_parts)
        return con.execute(sql, params).df() if params else con.execute(sql).df()

    def write_data(self, df: pd.DataFrame) -> int:
        if df.empty:
            return 0
        if not self._write_enabled:
            raise ValueError("目标数据源未开启 write_enabled，拒绝写入")

        key_cols = [self._date_column]
        if self._asset_column is not None:
            key_cols.append(self._asset_column)
        for col in key_cols:
            if col not in df.columns:
                raise ValueError(f"同步结果缺少去重键列: {col!r}")

        df_unique = df.drop_duplicates(subset=key_cols, keep="last").reset_index(drop=True)
        con = self._db()
        rel = self._rel
        con.register(_INCOMING_VIEW, df_unique)
        try:
            preds = [
                f"CAST(t.{quote_ident(self._date_column)} AS DATE) "
                f"= CAST(i.{quote_ident(self._date_column)} AS DATE)"
            ]
            if self._asset_column is not None:
                preds.append(
                    f"CAST(t.{quote_ident(self._asset_column)} AS VARCHAR) "
                    f"= CAST(i.{quote_ident(self._asset_column)} AS VARCHAR)"
                )
            con.execute(
                f"CREATE OR REPLACE TEMP VIEW {_NEW_ROWS_VIEW} AS "
                f"SELECT i.* FROM {_INCOMING_VIEW} AS i "
                f"WHERE NOT EXISTS (SELECT 1 FROM {rel} AS t WHERE {' AND '.join(preds)})"
            )
            new_count = int(con.execute(f"SELECT COUNT(*) FROM {_NEW_ROWS_VIEW}").fetchone()[0])
            if new_count == 0:
                return 0
            return self._persist_new_rows(con, _NEW_ROWS_VIEW, list(df_unique.columns), new_count)
        finally:
            with suppress(Exception):
                con.unregister(_INCOMING_VIEW)
            with suppress(Exception):
                con.execute(f"DROP VIEW IF EXISTS {_NEW_ROWS_VIEW}")
