from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.common.id import create_id_generator
from app.datetime_utils import utc_now_iso

DataSourceType = Literal["sql", "csv"]

generate_id = create_id_generator("datasources")


class SqlConfigStored(BaseModel):
    """Stored SQL source (structured db_* fields)."""

    db_driver: str = "postgresql"
    db_host: str = ""
    db_port: int | None = None
    db_username: str = ""
    db_password: str = ""
    db_name: str = ""
    table: str
    date_column: str
    asset_column: str
    column_map: dict[str, str] = Field(default_factory=dict)


class CsvConfigStored(BaseModel):
    path: str
    date_column: str
    asset_column: str
    read_csv_kwargs: dict[str, Any] = Field(default_factory=dict)


class DataSourceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    type: DataSourceType
    enabled: bool = True
    sql: SqlConfigStored | None = None
    csv: CsvConfigStored | None = None
    created_at: str
    updated_at: str

    @model_validator(mode="after")
    def _type_matches_payload(self) -> DataSourceRecord:
        if self.type == "sql" and self.sql is None:
            raise ValueError("sql config required when type is sql")
        if self.type == "csv" and self.csv is None:
            raise ValueError("csv config required when type is csv")
        if self.type == "sql" and self.csv is not None:
            raise ValueError("csv config must be omitted when type is sql")
        if self.type == "csv" and self.sql is not None:
            raise ValueError("sql config must be omitted when type is csv")
        return self


class RegistryFile(BaseModel):
    version: int = 1
    items: list[DataSourceRecord] = Field(default_factory=list)


# --- API payloads ---


class SqlCreate(BaseModel):
    db_driver: str = "postgresql"
    db_host: str
    db_port: int | None = None
    db_username: str = ""
    db_password: str = ""
    db_name: str
    table: str
    date_column: str
    asset_column: str
    column_map: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _host_and_db(self) -> SqlCreate:
        if not self.db_host.strip() or not self.db_name.strip():
            raise ValueError("主机（IP）与数据库名不能为空")
        d = self.db_driver.lower()
        if d not in ("postgres", "postgresql", "mysql", "mariadb"):
            raise ValueError("db_driver 须为 postgresql 或 mysql")
        return self


class CsvCreate(BaseModel):
    path: str
    date_column: str
    asset_column: str
    read_csv_kwargs: dict[str, Any] = Field(default_factory=dict)


class DataSourceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    type: DataSourceType
    enabled: bool = True
    sql: SqlCreate | None = None
    csv: CsvCreate | None = None

    @model_validator(mode="after")
    def _match(self) -> DataSourceCreate:
        if self.type == "sql":
            if self.sql is None:
                raise ValueError("sql is required when type is sql")
            if self.csv is not None:
                raise ValueError("csv must be omitted when type is sql")
        else:
            if self.csv is None:
                raise ValueError("csv is required when type is csv")
            if self.sql is not None:
                raise ValueError("sql must be omitted when type is csv")
        return self

    def to_record(self) -> DataSourceRecord:
        now = utc_now_iso()
        rid = generate_id()
        if self.type == "sql" and self.sql:
            s = self.sql
            sql = SqlConfigStored(
                db_driver=s.db_driver,
                db_host=s.db_host.strip(),
                db_port=s.db_port,
                db_username=s.db_username.strip(),
                db_password=s.db_password,
                db_name=s.db_name.strip(),
                table=s.table.strip(),
                date_column=s.date_column.strip(),
                asset_column=s.asset_column.strip(),
                column_map=dict(s.column_map),
            )
            return DataSourceRecord(
                id=rid,
                name=self.name,
                type="sql",
                enabled=self.enabled,
                sql=sql,
                csv=None,
                created_at=now,
                updated_at=now,
            )
        assert self.csv is not None
        csv = CsvConfigStored(
            path=self.csv.path,
            date_column=self.csv.date_column,
            asset_column=self.csv.asset_column,
            read_csv_kwargs=dict(self.csv.read_csv_kwargs),
        )
        return DataSourceRecord(
            id=rid,
            name=self.name,
            type="csv",
            enabled=self.enabled,
            sql=None,
            csv=csv,
            created_at=now,
            updated_at=now,
        )


class SqlPatch(BaseModel):
    db_driver: str | None = None
    db_host: str | None = None
    db_port: int | None = None
    db_username: str | None = None
    db_password: str | None = None
    db_name: str | None = None
    table: str | None = None
    date_column: str | None = None
    asset_column: str | None = None
    column_map: dict[str, str] | None = None


class CsvPatch(BaseModel):
    path: str | None = None
    date_column: str | None = None
    asset_column: str | None = None
    read_csv_kwargs: dict[str, Any] | None = None


class DataSourcePatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    enabled: bool | None = None
    sql: SqlPatch | None = None
    csv: CsvPatch | None = None


class SqlPublic(BaseModel):
    db_driver: str = "postgresql"
    db_host: str = ""
    db_port: int | None = None
    db_username: str = ""
    db_name: str = ""
    has_password: bool = False
    table: str
    date_column: str
    asset_column: str
    column_map: dict[str, str]


class CsvPublic(BaseModel):
    path: str
    date_column: str
    asset_column: str
    read_csv_kwargs: dict[str, Any]


class DataSourcePublic(BaseModel):
    id: str
    name: str
    type: DataSourceType
    enabled: bool
    sql: SqlPublic | None = None
    csv: CsvPublic | None = None
    created_at: str
    updated_at: str


def record_to_public(rec: DataSourceRecord) -> DataSourcePublic:
    sql_pub: SqlPublic | None = None
    csv_pub: CsvPublic | None = None
    if rec.type == "sql" and rec.sql:
        s = rec.sql
        sql_pub = SqlPublic(
            db_driver=s.db_driver or "postgresql",
            db_host=s.db_host,
            db_port=s.db_port,
            db_username=s.db_username,
            db_name=s.db_name,
            has_password=bool(s.db_password),
            table=s.table,
            date_column=s.date_column,
            asset_column=s.asset_column,
            column_map=dict(s.column_map),
        )
    elif rec.type == "csv" and rec.csv:
        csv_pub = CsvPublic(
            path=rec.csv.path,
            date_column=rec.csv.date_column,
            asset_column=rec.csv.asset_column,
            read_csv_kwargs=dict(rec.csv.read_csv_kwargs),
        )
    return DataSourcePublic(
        id=rec.id,
        name=rec.name,
        type=rec.type,
        enabled=rec.enabled,
        sql=sql_pub,
        csv=csv_pub,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


class TestResult(BaseModel):
    ok: bool
    message: str


class SqlTableColumnsRequest(BaseModel):
    """Resolve connection (optional merge from saved datasource) and inspect ``table``."""

    datasource_id: str | None = None
    db_driver: str = "postgresql"
    db_host: str = ""
    db_port: int | None = None
    db_username: str = ""
    db_password: str = ""
    db_name: str = ""
    table: str = ""


class SqlTableColumnsResponse(BaseModel):
    columns: list[str]


class DatasourceDependencyFieldsResponse(BaseModel):
    """因子依赖字段名：SQL 为 column_map 的键；CSV 为文件表头（不含日期/资产列）。"""

    fields: list[str]
