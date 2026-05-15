from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import pandas as pd
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec, VerifyResult, pop_write_flat_keys_from_mapping
from app.form import FormSchema
from factor.datasource import FactorDataSource
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import bindparam
from sqlalchemy.engine import Engine
from sqlmodel import create_engine, inspect, text


class SqlConnectionConfig(BaseModel):
    """数据库连接、表与可选的同步写入选项（均存于 ``connection`` 段）。"""

    model_config = ConfigDict(extra="ignore")

    db_driver: str = "postgresql"
    db_host: str = ""
    db_port: int | None = None
    db_username: str = ""
    db_password: str = ""
    db_name: str = ""
    table: str = ""
    write_enabled: bool = False

    @model_validator(mode="after")
    def _validate(self) -> SqlConnectionConfig:
        if not self.table.strip():
            raise ValueError("表名不能为空")
        d = (self.db_driver or "").lower()
        if d == "sqlite":
            if not (self.db_name or "").strip():
                raise ValueError("sqlite 须配置 db_name 为文件路径或 :memory:")
        else:
            if not self.db_host.strip() or not self.db_name.strip():
                raise ValueError("主机（IP）与数据库名不能为空")
            if d not in ("postgres", "postgresql", "mysql", "mariadb"):
                raise ValueError("db_driver 须为 postgresql、mysql 或 sqlite")
        return self


class SqlColumnsConfig(BaseModel):
    """日期列、资产列与列缓存（存储 ``columns`` 段）。"""

    model_config = ConfigDict(extra="ignore")

    date_column: str = "date"
    asset_column: str | None = "asset"
    columns: list[str] = Field(default_factory=list)
    column_map: dict[str, str] = Field(default_factory=dict)

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
    if driver == "sqlite":
        name = (cfg.db_name or "").strip()
        if name == ":memory:":
            return "sqlite:///:memory:"
        pth = Path(name).expanduser().resolve()
        return f"sqlite:///{pth.as_posix()}"
    raise ValueError(f"不支持的 db_driver: {cfg.db_driver!r}，请使用 postgresql、mysql 或 sqlite")


class SqlDataSource(FactorDataSource):
    """从 SQL 表读取普通 DataFrame（中性接口，不承载业务语义）。"""

    def __init__(
        self,
        engine: str | Engine,
        *,
        table: str,
        date_column: str = "date",
        asset_column: str | None = "asset",
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
                description="配置数据库连接、数据表及可选的同步追加写入。",
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
                                {"const": "sqlite", "title": "SQLite（测试/本地）"},
                            ],
                        },
                        "db_host": {"type": "string", "title": "主机（IP）"},
                        "db_port": {"type": ["integer", "null"], "title": "端口"},
                        "db_username": {"type": "string", "title": "用户名"},
                        "db_password": {"type": "string", "title": "密码"},
                        "db_name": {"type": "string", "title": "数据库名"},
                        "table": {"type": "string", "title": "表名"},
                        "write_enabled": {
                            "type": "boolean",
                            "title": "允许同步写入（追加行）",
                            "default": False,
                        },
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

    def validate_config(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ) -> dict[str, Any]:
        conn_raw = dict(connection_config or {})
        cols_only, legacy_write = pop_write_flat_keys_from_mapping(dict(columns_config or {}))
        for k, v in legacy_write.items():
            if k not in conn_raw:
                conn_raw[k] = v
        conn = SqlConnectionConfig.model_validate(conn_raw)
        col = SqlColumnsConfig.model_validate(cols_only)
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
        }

    def list_sync_target_physical_columns(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ) -> list[str] | None:
        _ = columns_config
        from datasource_plugins_builtin.sql_sync import list_sql_table_physical_columns

        return list_sql_table_physical_columns(connection_config)

    def write_sync_dataframe(
        self,
        *,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
        df: pd.DataFrame,
    ) -> int:
        from datasource_plugins_builtin.sql_sync import write_dataframe_to_sql_table

        return write_dataframe_to_sql_table(
            connection_config=connection_config,
            columns_config=columns_config,
            df=df,
        )

    def to_factor_datasource(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ):
        conn = SqlConnectionConfig.model_validate(dict(connection_config or {}))
        col = SqlColumnsConfig.model_validate(dict(columns_config or {}))
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
        )

    def verify(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ) -> VerifyResult:
        _ = columns_config  # 连接探测不依赖列段
        try:
            conn = SqlConnectionConfig.model_validate(dict(connection_config or {}))
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
