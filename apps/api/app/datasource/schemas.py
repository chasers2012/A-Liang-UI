from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator
from app.datasource.models import DataSourceRow
from app.datasource.plugins import (
    UnknownDataSourceTypeError,
    get_datasource_plugin,
    merge_datasource_config_schemas,
)
from app.plugin import redact_config

DataSourceType = str

generate_id = create_id_generator("datasources")


class RegistryFile(BaseModel):
    version: int = 1
    items: list[DataSourceRow] = Field(default_factory=list)


# --- API payloads ---


class DataSourceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    type: DataSourceType
    config: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_type_and_config(self) -> DataSourceCreate:
        if not str(self.type).strip():
            raise ValueError("type is required")
        if self.config is None:
            raise ValueError("config is required")
        return self

    def to_row(self) -> DataSourceRow:
        now = utc_now_iso()
        rid = generate_id()
        return DataSourceRow(
            id=rid,
            name=self.name,
            type=str(self.type).strip(),
            config=dict(self.config or {}),
            created_at=now,
            updated_at=now,
        )


class DataSourcePatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    # replace semantics: when present, overwrite record.config
    config: dict[str, Any] | None = None


class DataSourcePublic(BaseModel):
    id: str
    name: str
    type: DataSourceType
    config: dict[str, Any]
    created_at: str
    updated_at: str


def row_to_public(row: DataSourceRow) -> DataSourcePublic:
    schema = None
    try:
        plugin = get_datasource_plugin(str(row.type))
        schema = merge_datasource_config_schemas(
            plugin.get_connection_config_schema(),
            plugin.get_columns_config_schema(),
        )
    except UnknownDataSourceTypeError:
        schema = None
    return DataSourcePublic(
        id=row.id,
        name=row.name,
        type=str(row.type),
        config=redact_config(dict(row.config or {}), schema),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class TestResult(BaseModel):
    ok: bool
    message: str


class InspectColumnsRequest(BaseModel):
    """
    Generic column inspection request.

    - Provide `type` + `config` to inspect without saving.
    - Or provide `datasource_id` and optionally overlay `config` to inspect a saved datasource; secret fields
      from the client that are blank or redacted (``***``) keep the stored values.
    """

    datasource_id: str | None = None
    type: str | None = None
    config: dict[str, Any] | None = None


class InspectColumnsResponse(BaseModel):
    """列探测结果：可用列名与建议的字段映射（与数据源 ``config`` 同级字段）。"""

    columns: list[str]
    date_column: str
    asset_column: str | None = None


class DatasourceDependencyFieldsResponse(BaseModel):
    """数据源物理列名列表。"""

    fields: list[str]


class DatasourcePluginPublic(BaseModel):
    type: str
    title: str
    description: str | None = None
    connection_json_schema: dict[str, Any] = Field(default_factory=dict)
    connection_ui_schema: dict[str, Any] = Field(default_factory=dict)
    columns_json_schema: dict[str, Any] = Field(default_factory=dict)
    columns_ui_schema: dict[str, Any] = Field(default_factory=dict)
