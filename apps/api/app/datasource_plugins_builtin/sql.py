from __future__ import annotations

from typing import Any, Literal

from app.datasource.plugins import (
    DataSourcePlugin,
    PluginConfigField,
    PluginConfigSchema,
    PluginFieldOption,
    VerifyResult,
)
from datasources import SqlDataSource
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import create_engine, inspect, text


class SqlConfig(BaseModel):
    db_driver: str = "postgresql"
    db_host: str = ""
    db_port: int | None = None
    db_username: str = ""
    db_password: str = ""
    db_name: str = ""
    table: str = ""
    column_map: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate(self) -> SqlConfig:
        if not self.db_host.strip() or not self.db_name.strip():
            raise ValueError("主机（IP）与数据库名不能为空")
        if not self.table.strip():
            raise ValueError("表名不能为空")
        d = (self.db_driver or "").lower()
        if d not in ("postgres", "postgresql", "mysql", "mariadb"):
            raise ValueError("db_driver 须为 postgresql 或 mysql")
        return self


def _auth_fragment(username: str, password: str) -> str:
    from urllib.parse import quote_plus

    if not username and not password:
        return ""
    if not username:
        return f":{quote_plus(password)}@"
    if not password:
        return f"{quote_plus(username)}@"
    return f"{quote_plus(username)}:{quote_plus(password)}@"


def build_sqlalchemy_url(cfg: SqlConfig) -> str:
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


class SqlDataSourcePlugin(DataSourcePlugin):
    type: Literal["sql"] = "sql"

    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = SqlConfig.model_validate(config)
        return cfg.model_dump(mode="json")

    def to_factor_datasource(self, config: dict[str, Any]):
        cfg = SqlConfig.model_validate(config)
        url = build_sqlalchemy_url(cfg)
        return SqlDataSource(engine=url, table=cfg.table.strip())

    def verify(self, config: dict[str, Any]) -> VerifyResult:
        try:
            cfg = SqlConfig.model_validate(config)
            url = build_sqlalchemy_url(cfg)
        except Exception as e:
            return VerifyResult(ok=False, message=str(e))
        try:
            engine = create_engine(url)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e:
            return VerifyResult(ok=False, message=f"SQL 连接失败: {e}")
        return VerifyResult(ok=True, message="SQL 连接成功。")

    def list_table_columns(self, config: dict[str, Any]) -> list[str]:
        cfg = SqlConfig.model_validate(config)
        url = build_sqlalchemy_url(cfg)
        engine = create_engine(url)
        insp = inspect(engine)
        schema = None
        table = cfg.table.strip()
        if "." in table:
            schema, table = table.split(".", 1)
        cols = insp.get_columns(table, schema=schema)
        return [str(c["name"]) for c in cols]

    def get_config_schema(self) -> PluginConfigSchema | None:
        return PluginConfigSchema(
            title="SQL 数据源",
            description="配置数据库连接和数据表信息。",
            fields=[
                PluginConfigField(
                    key="db_driver",
                    label="数据库类型",
                    kind="select",
                    required=True,
                    options=[
                        PluginFieldOption(value="postgresql", label="PostgreSQL"),
                        PluginFieldOption(value="mysql", label="MySQL / MariaDB"),
                    ],
                ),
                PluginConfigField(
                    key="db_host",
                    label="主机（IP）",
                    required=True,
                    placeholder="127.0.0.1",
                ),
                PluginConfigField(
                    key="db_port",
                    label="端口",
                    kind="number",
                    placeholder="留空使用默认端口",
                ),
                PluginConfigField(
                    key="db_username",
                    label="用户名",
                ),
                PluginConfigField(
                    key="db_password",
                    label="密码",
                    kind="password",
                    help_text="编辑时留空表示保持原密码（由后端合并）。",
                ),
                PluginConfigField(
                    key="db_name",
                    label="数据库名",
                    required=True,
                ),
                PluginConfigField(
                    key="table",
                    label="表名（可含 schema）",
                    required=True,
                ),
            ],
        )


SQL_PLUGIN = SqlDataSourcePlugin()
