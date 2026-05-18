from __future__ import annotations

from typing import Any, Literal

import pandas as pd
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec, VerifyResult
from app.form import FormSchema
from factor.datasource import FactorDataSource
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import bindparam
from sqlalchemy.engine import Engine
from sqlmodel import create_engine, inspect, text


class SqlWriteConfig(BaseModel):
    """同步写入选项（存于 ``write`` 段）。"""

    model_config = ConfigDict(extra="ignore")

    write_enabled: bool = False


class SqlConnectionConfig(BaseModel):
    """数据库连接与表（存于 ``connection`` 段）。"""

    model_config = ConfigDict(extra="ignore")

    db_driver: str = "postgresql"
    db_host: str = ""
    db_port: int | None = None
    db_username: str = ""
    db_password: str = ""
    db_name: str = ""
    table: str = ""

    @model_validator(mode="after")
    def _validate(self) -> SqlConnectionConfig:
        if not self.table.strip():
            raise ValueError("表名不能为空")
        d = (self.db_driver or "").lower()
        if not self.db_host.strip() or not self.db_name.strip():
            raise ValueError("主机（IP）与数据库名不能为空")
        if d not in ("postgres", "postgresql", "mysql", "mariadb"):
            raise ValueError("db_driver 须为 postgresql、mysql 或 mysql/mariadb")
        return self


class SqlColumnsConfig(BaseModel):
    """日期列、资产列与列缓存（存储 ``columns`` 段）。"""

    model_config = ConfigDict(extra="ignore")

    date_column: str = "date"
    asset_column: str | None = "asset"
    columns: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> SqlColumnsConfig:
        date_col = str(self.date_column).strip()
        if not date_col:
            raise ValueError("date_column 不能为空")
        self.date_column = date_col
        if self.asset_column is not None:
            asset_col = str(self.asset_column).strip()
            self.asset_column = asset_col or None
        self.columns = [str(c).strip() for c in self.columns if str(c).strip()]
        return self


def _as_engine(engine: str | Engine) -> Engine:
    if isinstance(engine, Engine):
        return engine
    return create_engine(engine)


def _quote_ident(engine: Engine, name: str) -> str:
    prep = engine.dialect.identifier_preparer
    if "." in name:
        return ".".join(prep.quote(p) for p in name.split("."))
    return prep.quote(name)


def _nan_to_none_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in df.replace({pd.NA: None}).to_dict(orient="records"):
        rec = {k: (None if pd.isna(v) else v) for k, v in row.items()}
        out.append(rec)
    return out


def _execute_insert_loop(engine: Engine, sql: str, records: list[dict[str, Any]]) -> int:
    stmt = text(sql)
    with engine.begin() as cx:
        for rec in records:
            cx.execute(stmt, rec)
    return len(records)


def _auth_fragment(username: str, password: str) -> str:
    from urllib.parse import quote_plus

    if not username and not password:
        return ""
    if not username:
        return f":{quote_plus(password)}@"
    if not password:
        return f"{quote_plus(username)}@"
    return f"{quote_plus(username)}:{quote_plus(password)}@"


def build_sqlalchemy_url(cfg: SqlConnectionConfig) -> str:
    from urllib.parse import quote_plus

    host = (cfg.db_host or "").strip()
    db_name = (cfg.db_name or "").strip()
    user = (cfg.db_username or "").strip()
    password = cfg.db_password or ""
    driver = (cfg.db_driver or "postgresql").lower()
    port = cfg.db_port
    auth = _auth_fragment(user, password)
    db_path = quote_plus(db_name)

    if driver in ("postgres", "postgresql"):
        p = int(port) if port is not None else 5432
        return f"postgresql+psycopg://{auth}{host}:{p}/{db_path}"
    if driver in ("mysql", "mariadb"):
        p = int(port) if port is not None else 3306
        return f"mysql+pymysql://{auth}{host}:{p}/{db_path}"
    raise ValueError(f"不支持的 db_driver: {cfg.db_driver!r}，请使用 postgresql 或 mysql")


def _sql_sync_key_columns(*, date_column: str, asset_column: str | None) -> list[str]:
    cols = [date_column]
    if asset_column:
        cols.append(asset_column)
    return cols


def _sql_normalize_sync_keys(
    df: pd.DataFrame,
    *,
    date_column: str,
    asset_column: str | None,
) -> pd.DataFrame:
    if df.empty:
        key_cols = _sql_sync_key_columns(date_column=date_column, asset_column=asset_column)
        return pd.DataFrame(columns=key_cols)
    out = df.loc[
        :, _sql_sync_key_columns(date_column=date_column, asset_column=asset_column)
    ].copy()
    out[date_column] = pd.to_datetime(out[date_column], errors="coerce").dt.normalize()
    if asset_column is not None:
        out[asset_column] = out[asset_column].astype(str)
    return out.drop_duplicates().reset_index(drop=True)


def _sql_filter_sync_new_rows(
    df: pd.DataFrame,
    *,
    existing_keys: pd.DataFrame,
    date_column: str,
    asset_column: str | None,
) -> pd.DataFrame:
    if df.empty or existing_keys.empty:
        return df.reset_index(drop=True)
    key_cols = _sql_sync_key_columns(date_column=date_column, asset_column=asset_column)
    for col in key_cols:
        if col not in df.columns:
            raise ValueError(f"同步结果缺少去重键列: {col!r}")
    incoming_keys = _sql_normalize_sync_keys(df, date_column=date_column, asset_column=asset_column)
    known_keys = _sql_normalize_sync_keys(
        existing_keys, date_column=date_column, asset_column=asset_column
    )
    merged = incoming_keys.merge(known_keys, on=key_cols, how="left", indicator=True)
    is_new = merged["_merge"] == "left_only"
    out = df.loc[is_new.to_numpy()].reset_index(drop=True)
    return out.drop_duplicates(subset=key_cols, keep="last").reset_index(drop=True)


class SqlDataSource(FactorDataSource):
    """从 SQL 表读取普通 DataFrame（中性接口，不承载业务语义）。"""

    def __init__(
        self,
        engine: str | Engine,
        *,
        table: str,
        date_column: str = "date",
        asset_column: str | None = "asset",
        write_enabled: bool = False,
    ) -> None:
        self._engine = _as_engine(engine)
        self._table = str(table)
        self._table_sql = _quote_ident(self._engine, self._table)
        self._date_column = str(date_column).strip()
        self._asset_column = (
            str(asset_column).strip()
            if asset_column is not None and str(asset_column).strip()
            else None
        )
        self._write_enabled = bool(write_enabled)

    @property
    def date_column(self) -> str:
        return self._date_column

    @property
    def asset_column(self) -> str | None:
        return self._asset_column

    def list_columns(self) -> list[str]:
        insp = inspect(self._engine)
        schema = None
        table = self._table
        if "." in table:
            schema, table = table.split(".", 1)
        cols = [c.get("name") for c in insp.get_columns(table, schema=schema)]
        cols = [str(c) for c in cols if c]
        return sorted(set(cols), key=lambda x: (x.lower(), x))

    def list_sync_target_physical_columns(self) -> list[str]:
        return self.list_columns()

    def _load_existing_sync_keys(self) -> pd.DataFrame:
        key_cols = _sql_sync_key_columns(
            date_column=self._date_column,
            asset_column=self._asset_column,
        )
        quoted_cols = [_quote_ident(self._engine, c) for c in key_cols]
        col_list_sql = ", ".join(quoted_cols)
        sql = f"SELECT DISTINCT {col_list_sql} FROM {self._table_sql}"
        with self._engine.connect() as cx:
            return pd.read_sql(text(sql), cx)

    def write_sync_dataframe(self, df: pd.DataFrame) -> int:
        if df.empty:
            return 0
        if not self._write_enabled:
            raise ValueError("目标数据源未开启 write_enabled，拒绝写入")

        existing_keys = self._load_existing_sync_keys()
        df = _sql_filter_sync_new_rows(
            df,
            existing_keys=existing_keys,
            date_column=self._date_column,
            asset_column=self._asset_column,
        )
        if df.empty:
            return 0

        engine = self._engine
        table_sql = self._table_sql
        db_cols = list(df.columns)
        if not db_cols:
            return 0

        quoted_cols = [_quote_ident(engine, c) for c in db_cols]
        col_list_sql = ", ".join(quoted_cols)
        placeholders = ", ".join(f":{c}" for c in db_cols)
        records = _nan_to_none_records(df)
        sql = f"INSERT INTO {table_sql} ({col_list_sql}) VALUES ({placeholders})"
        return _execute_insert_loop(engine, sql, records)

    def load_frame(
        self,
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
    ) -> pd.DataFrame:
        prep = self._engine.dialect.identifier_preparer

        cols = [str(c) for c in columns]
        if not cols:
            return pd.DataFrame()
        select_parts = []
        for c in cols:
            qc = _quote_ident(self._engine, c)
            select_parts.append(f"{qc} AS {prep.quote(c)}")

        where_parts: list[str] = []
        params: dict = {}
        stmt = None

        codes_needed = False
        if self._date_column:
            date_column = self._date_column
            col_sql = _quote_ident(self._engine, date_column)
            if start_date is not None:
                where_parts.append(f"{col_sql} >= :date_start")
                params["date_start"] = str(start_date)
            if end_date is not None:
                where_parts.append(f"{col_sql} <= :date_end")
                params["date_end"] = str(end_date)

        if asset_values is not None:
            asset_column = self._asset_column
            if asset_column is None:
                raise ValueError("asset_values 过滤需要 asset_column")
            col_sql = _quote_ident(self._engine, asset_column)
            where_parts.append(f"{col_sql} IN :asset_values")
            params["asset_values"] = [str(v) for v in asset_values]
            codes_needed = True

        sql = f"SELECT {', '.join(select_parts)} FROM {self._table_sql}"
        if where_parts:
            sql += f" WHERE {' AND '.join(where_parts)}"
        stmt = text(sql)
        if codes_needed:
            stmt = stmt.bindparams(bindparam("asset_values", expanding=True))

        return pd.read_sql(stmt, self._engine, params=params)


class SqlDataSourceSpec(DataSourceSpec):
    def __init__(self) -> None:
        super().__init__(
            connection_schema=FormSchema(
                title="SQL 数据源",
                description="配置数据库连接与数据表。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "db_driver": {
                            "title": "数据库类型",
                            "type": "string",
                            "default": "postgresql",
                            "oneOf": [
                                {"const": "postgresql", "title": "PostgreSQL"},
                                {"const": "mysql", "title": "MySQL / MariaDB"},
                            ],
                        },
                        "db_host": {"type": "string", "title": "主机（IP）", "minLength": 1},
                        "db_port": {"type": ["integer", "null"], "title": "端口"},
                        "db_username": {"type": "string", "title": "用户名"},
                        "db_password": {"type": "string", "title": "密码"},
                        "db_name": {"type": "string", "title": "数据库名"},
                        "table": {"type": "string", "title": "表名"},
                    },
                    "required": ["db_driver", "db_host", "db_name", "table"],
                },
                ui_schema={
                    "db_host": {"ui:placeholder": "127.0.0.1"},
                    "db_port": {"ui:placeholder": "留空使用默认端口"},
                    "db_password": {
                        "ui:widget": "password",
                        "ui:help": "编辑时留空表示保持原密码。",
                    },
                },
            ),
            write_schema=FormSchema(
                title="SQL 数据写入",
                description="配置是否允许数据同步任务向该表追加写入。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "write_enabled": {
                            "type": "boolean",
                            "title": "允许写入",
                            "default": False,
                            "description": "勾选后该数据源可作为数据同步的目标数据源",
                        },
                    },
                },
            ),
            columns_schema=FormSchema(
                title="SQL 字段配置",
                description="根据连接探测到的列，选择日期列和资产列。",
                json_schema={
                    "type": "object",
                    "properties": {
                        "date_column": {"type": "string", "title": "日期列", "default": "date"},
                        "asset_column": {
                            "type": ["string", "null"],
                            "title": "资产列",
                            "default": "asset",
                        },
                        "columns": {
                            "type": "array",
                            "title": "可选列缓存",
                            "items": {"type": "string"},
                            "default": [],
                        },
                        "column_map": {
                            "type": "object",
                            "title": "列名映射",
                            "default": {},
                            "additionalProperties": {"type": "string"},
                        },
                    },
                    "required": ["date_column"],
                },
                ui_schema={
                    "columns": {"ui:widget": "hidden"},
                    "column_map": {"ui:widget": "hidden"},
                },
            ),
        )

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(config or {})
        conn = SqlConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        col = SqlColumnsConfig.model_validate(dict(raw.get("columns") or {}))
        write = SqlWriteConfig.model_validate(dict(raw.get("write") or {}))
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
            "write": write.model_dump(mode="json"),
        }

    def to_factor_datasource(self, config: dict[str, Any]):
        raw = dict(config or {})
        conn = SqlConnectionConfig.model_validate(dict(raw.get("connection") or {}))
        col = SqlColumnsConfig.model_validate(dict(raw.get("columns") or {}))
        write = SqlWriteConfig.model_validate(dict(raw.get("write") or {}))
        url = build_sqlalchemy_url(conn)
        eng = (
            create_engine(url, connect_args={"check_same_thread": False})
            if ":memory:" in url
            else create_engine(url)
        )
        return SqlDataSource(
            engine=eng,
            table=conn.table.strip(),
            date_column=col.date_column,
            asset_column=col.asset_column,
            write_enabled=write.write_enabled,
        )

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        raw = dict(config or {})
        try:
            conn = SqlConnectionConfig.model_validate(dict(raw.get("connection") or {}))
            url = build_sqlalchemy_url(conn)
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))
        try:
            connect_args = {} if ":memory:" not in url else {"check_same_thread": False}
            engine = create_engine(url, connect_args=connect_args)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e:
            return VerifyResult(ok=False, message=f"SQL 连接失败: {e}")
        return VerifyResult(ok=True, message="SQL 连接成功。")


class SqlDataSourcePlugin(DataSourcePlugin):
    name: Literal["sql"] = "sql"

    spec = SqlDataSourceSpec()


SQL_PLUGIN = SqlDataSourcePlugin()
