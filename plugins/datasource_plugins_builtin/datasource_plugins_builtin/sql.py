from __future__ import annotations

from contextlib import suppress
from dataclasses import dataclass
from typing import Any, Literal

import duckdb
from app.datasource.plugins import DataSourcePlugin
from app.datasource.schemas import DataSourceSpec, VerifyResult
from app.form import FormSchema
from pydantic import BaseModel, ConfigDict, model_validator

from ._duckdb_backend import (
    DatasourceColumnsConfig,
    DatasourceWriteConfig,
    DuckDbDataSource,
    duckdb_load_and_attach,
    quote_ident,
)

_REMOTE = "remote"


@dataclass(frozen=True, slots=True)
class SqlDriverProfile:
    """DuckDB ATTACH 驱动描述；新增库类型时在此表追加一条即可。"""

    id: str
    title: str
    duckdb_extension: str
    default_port: int
    database_dsn_key: str
    default_schema: str | None = None
    aliases: frozenset[str] = frozenset()


SQL_DRIVERS: tuple[SqlDriverProfile, ...] = (
    SqlDriverProfile(
        id="postgresql",
        title="PostgreSQL",
        duckdb_extension="postgres",
        default_port=5432,
        database_dsn_key="dbname",
        default_schema="public",
        aliases=frozenset({"postgres"}),
    ),
    SqlDriverProfile(
        id="mysql",
        title="MySQL / MariaDB",
        duckdb_extension="mysql",
        default_port=3306,
        database_dsn_key="database",
        default_schema=None,
        aliases=frozenset({"mariadb"}),
    ),
)

_DRIVER_BY_KEY: dict[str, SqlDriverProfile] = {
    key: profile
    for profile in SQL_DRIVERS
    for key in (profile.id.lower(), *(a.lower() for a in profile.aliases))
}


def resolve_sql_driver(db_driver: str) -> SqlDriverProfile:
    profile = _DRIVER_BY_KEY.get((db_driver or "").strip().lower())
    if profile is None:
        options = "、".join(p.title for p in SQL_DRIVERS)
        raise ValueError(f"不支持的 db_driver: {db_driver!r}，可选: {options}")
    return profile


def sql_driver_form_options() -> list[dict[str, str]]:
    return [{"const": p.id, "title": p.title} for p in SQL_DRIVERS]


class SqlWriteConfig(DatasourceWriteConfig):
    pass


class SqlConnectionConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    db_driver: str = SQL_DRIVERS[0].id
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
        if not self.db_host.strip() or not self.db_name.strip():
            raise ValueError("主机（IP）与数据库名不能为空")
        profile = resolve_sql_driver(self.db_driver)
        self.db_driver = profile.id
        return self


class SqlColumnsConfig(DatasourceColumnsConfig):
    pass


def _dsn_pair(key: str, value: str | int) -> str:
    if isinstance(value, int):
        return f"{key}={value}"
    s = str(value)
    if s == "":
        return f"{key}=''"
    if any(c in s for c in " \t'\\"):
        escaped = s.replace("\\", "\\\\").replace("'", "\\'")
        return f"{key}='{escaped}'"
    return f"{key}={s}"


def build_duckdb_attach_dsn(cfg: SqlConnectionConfig) -> tuple[str, str]:
    profile = resolve_sql_driver(cfg.db_driver)
    host = (cfg.db_host or "").strip()
    db_name = (cfg.db_name or "").strip()
    port = int(cfg.db_port) if cfg.db_port is not None else profile.default_port

    pairs = [_dsn_pair("host", host), _dsn_pair("port", port)]
    user = (cfg.db_username or "").strip()
    if user:
        pairs.append(_dsn_pair("user", user))
    if cfg.db_password:
        pairs.append(_dsn_pair("password", cfg.db_password))
    pairs.append(_dsn_pair(profile.database_dsn_key, db_name))
    return " ".join(pairs), profile.duckdb_extension


def _default_schema(profile: SqlDriverProfile, cfg: SqlConnectionConfig) -> str:
    if profile.default_schema is not None:
        return profile.default_schema
    return (cfg.db_name or "").strip() or "main"


def _qualified_table(cfg: SqlConnectionConfig) -> str:
    profile = resolve_sql_driver(cfg.db_driver)
    schema_default = _default_schema(profile, cfg)
    raw = str(cfg.table).strip()
    if "." in raw:
        schema, name = raw.split(".", 1)
        schema = schema.strip() or schema_default
    else:
        schema = schema_default
        name = raw
    return f"{quote_ident(_REMOTE)}.{quote_ident(schema)}.{quote_ident(name.strip())}"


class SqlDataSource(DuckDbDataSource):
    def __init__(
        self,
        connection: SqlConnectionConfig,
        *,
        date_column: str = "date",
        asset_column: str | None = "asset",
        write_enabled: bool = False,
    ) -> None:
        super().__init__(
            date_column=date_column,
            asset_column=asset_column,
            write_enabled=write_enabled,
        )
        self._dsn, self._duckdb_extension = build_duckdb_attach_dsn(connection)
        self._rel = _qualified_table(connection)

    def _prepare(self, con: duckdb.DuckDBPyConnection) -> None:
        duckdb_load_and_attach(
            con,
            driver=self._duckdb_extension,
            dsn=self._dsn,
            read_only=not self._write_enabled,
        )

    def _persist_new_rows(
        self,
        con: duckdb.DuckDBPyConnection,
        new_rows_view: str,
        incoming_columns: list[str],
        new_row_count: int,
    ) -> int:
        if not incoming_columns:
            return 0
        cols = ", ".join(quote_ident(c) for c in incoming_columns)
        con.execute(f"INSERT INTO {self._rel} ({cols}) SELECT {cols} FROM {new_rows_view}")
        return new_row_count

    def verify(self) -> VerifyResult:
        con: duckdb.DuckDBPyConnection | None = None
        try:
            con = duckdb.connect(":memory:")
            try:
                duckdb_load_and_attach(
                    con,
                    driver=self._duckdb_extension,
                    dsn=self._dsn,
                    read_only=True,
                )
            except (duckdb.Error, RuntimeError) as e:
                return VerifyResult(ok=False, message=str(e))
            con.execute("SELECT 1")
        except Exception as e:
            return VerifyResult(ok=False, message=f"SQL 连接失败: {e}")
        finally:
            if con is not None:
                with suppress(Exception):
                    con.close()
        return VerifyResult(ok=True, message="SQL 连接成功。")


def _parse_sql_config(
    raw: dict[str, Any],
) -> tuple[SqlConnectionConfig, SqlColumnsConfig, SqlWriteConfig]:
    return (
        SqlConnectionConfig.model_validate(dict(raw.get("connection") or {})),
        SqlColumnsConfig.model_validate(dict(raw.get("columns") or {})),
        SqlWriteConfig.model_validate(dict(raw.get("write") or {})),
    )


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
                            "default": SQL_DRIVERS[0].id,
                            "oneOf": sql_driver_form_options(),
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
        conn, col, write = _parse_sql_config(dict(config or {}))
        return {
            "connection": conn.model_dump(mode="json"),
            "columns": col.model_dump(mode="json"),
            "write": write.model_dump(mode="json"),
        }

    def to_datasource(self, config: dict[str, Any]):
        conn, col, write = _parse_sql_config(dict(config or {}))
        return SqlDataSource(
            connection=conn,
            date_column=col.date_column,
            asset_column=col.asset_column,
            write_enabled=write.write_enabled,
        )

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        try:
            return self.to_datasource(config).verify()
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))


class SqlDataSourcePlugin(DataSourcePlugin):
    name: Literal["sql"] = "sql"
    spec = SqlDataSourceSpec()


__all__ = ["SqlDataSourcePlugin"]
