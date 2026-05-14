from __future__ import annotations

from abc import ABC, abstractmethod
from copy import deepcopy
from typing import Any

from factor import FactorDataSource
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator
from app.datasource.models import DataSourceRow
from app.form import FormSchema

DataSourceType = str

generate_id = create_id_generator("datasources")


class VerifyResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    ok: bool
    message: str


class DataSourceSpec(ABC):
    """Form schemas and config/datasource behavior for a datasource plugin."""

    def __init__(
        self,
        connection_config: FormSchema | None = None,
        columns_config: FormSchema | None = None,
    ) -> None:
        self.connection_config = connection_config
        self.columns_config = columns_config

    def resolved_connection_secret_keys(self) -> list[str]:
        connection_schema = self.connection_config
        return connection_schema.resolved_secret_keys() if connection_schema is not None else []

    def resolved_columns_secret_keys(self) -> list[str]:
        columns_schema = self.columns_config
        return columns_schema.resolved_secret_keys() if columns_schema is not None else []

    def decrypt_storage_config(self, stored_config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(stored_config or {})
        connection_schema = self.connection_config
        columns_schema = self.columns_config
        connection = dict(raw.get("connection") or {})
        columns = dict(raw.get("columns") or {})
        return {
            "connection": (
                connection_schema.decrypt_form(connection)
                if connection_schema is not None
                else connection
            ),
            "columns": (
                columns_schema.decrypt_form(columns) if columns_schema is not None else columns
            ),
        }

    def encrypt_storage_config(self, storage_config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(storage_config or {})
        connection_schema = self.connection_config
        columns_schema = self.columns_config
        connection = dict(raw.get("connection") or {})
        columns = dict(raw.get("columns") or {})
        return {
            "connection": (
                connection_schema.encrypt_form(connection)
                if connection_schema is not None
                else connection
            ),
            "columns": (
                columns_schema.encrypt_form(columns) if columns_schema is not None else columns
            ),
        }

    def merge_overlay_with_saved_secrets(
        self,
        saved: dict[str, Any],
        overlay: dict[str, Any],
    ) -> dict[str, Any]:
        saved_plain = self.decrypt_storage_config(dict(saved or {}))
        overlay_raw = dict(overlay or {})
        connection_overlay = dict(overlay_raw.get("connection") or {})
        columns_overlay = dict(overlay_raw.get("columns") or {})

        def _merge_part(
            schema: FormSchema | None,
            saved_part: dict[str, Any],
            overlay_part: dict[str, Any],
        ) -> dict[str, Any]:
            if schema is None:
                return {**saved_part, **overlay_part}
            return schema.merge_overlay_keep_secrets(saved_part, overlay_part)

        return {
            "connection": _merge_part(
                self.connection_config,
                dict(saved_plain.get("connection") or {}),
                connection_overlay,
            ),
            "columns": _merge_part(
                self.columns_config,
                dict(saved_plain.get("columns") or {}),
                columns_overlay,
            ),
        }

    @abstractmethod
    def validate_config(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ) -> dict[str, Any]:
        """校验并规范化配置，返回可 JSON 序列化的 ``{connection, columns}`` 存储形态。"""

    @abstractmethod
    def verify(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ) -> VerifyResult:
        """校验连接或可读性；入参为已解密的 ``connection`` / ``columns`` 配置。"""

    @abstractmethod
    def to_factor_datasource(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ) -> FactorDataSource:
        """由已解密的 ``connection`` / ``columns`` 配置构建 :class:`~factor.datasource.FactorDataSource`。"""


# --- API payloads ---


class DataSourceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    type: DataSourceType
    connection_config: dict[str, Any] = Field(default_factory=dict)
    columns_config: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_type_and_config(self) -> DataSourceCreate:
        if not str(self.type).strip():
            raise ValueError("type is required")
        if self.connection_config is None:
            raise ValueError("connection_config is required")
        if self.columns_config is None:
            raise ValueError("columns_config is required")
        return self

    def to_row(self) -> DataSourceRow:
        now = utc_now_iso()
        rid = generate_id()
        return DataSourceRow(
            id=rid,
            name=self.name,
            type=str(self.type).strip(),
            config={
                "connection": dict(self.connection_config or {}),
                "columns": dict(self.columns_config or {}),
            },
            created_at=now,
            updated_at=now,
        )


class DataSourcePatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    connection_config: dict[str, Any] | None = None
    columns_config: dict[str, Any] | None = None


class DataSourcePublic(BaseModel):
    id: str
    name: str
    type: DataSourceType
    config: dict[str, Any]
    created_at: str
    updated_at: str


def row_to_public(row: DataSourceRow) -> DataSourcePublic:
    from app.datasource.plugins import get_datasource_plugin

    plugin = get_datasource_plugin(str(row.type))
    connection_schema = plugin.spec.connection_config
    columns_schema = plugin.spec.columns_config
    raw_config = dict(row.config or {})
    public_config = deepcopy(raw_config)
    if not isinstance(public_config.get("connection"), dict):
        public_config["connection"] = {}
    if not isinstance(public_config.get("columns"), dict):
        public_config["columns"] = {}
    if connection_schema is not None:
        public_config["connection"] = connection_schema.redact(
            dict(public_config.get("connection") or {})
        )
    if columns_schema is not None:
        public_config["columns"] = columns_schema.redact(dict(public_config.get("columns") or {}))
    return DataSourcePublic(
        id=row.id,
        name=row.name,
        type=str(row.type),
        config=public_config,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


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
