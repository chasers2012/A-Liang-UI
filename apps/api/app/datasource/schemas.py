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


DATASOURCE_WRITE_FLAT_KEYS = frozenset({"write_enabled"})


def pop_write_flat_keys_from_mapping(
    columns_like: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """从仍含扁平 ``write_*`` 键的 ``columns`` 片段中拆出写入配置（兼容旧存储）。"""
    rest = dict(columns_like or {})
    w: dict[str, Any] = {}
    for k in DATASOURCE_WRITE_FLAT_KEYS:
        if k in rest:
            w[k] = rest.pop(k)
    return rest, w


def merged_write_flat_dict_from_storage(plain: dict[str, Any]) -> dict[str, Any]:
    """从 ``connection``、旧版 ``columns`` 或顶层 ``write`` 合并出扁平 ``write_*`` 配置（供同步校验）。"""
    conn = dict(plain.get("connection") or {})
    w = {k: conn[k] for k in DATASOURCE_WRITE_FLAT_KEYS if k in conn}
    cols = dict(plain.get("columns") or {})
    top = dict(plain.get("write") or {})
    for src in (cols, top):
        for k in DATASOURCE_WRITE_FLAT_KEYS:
            if k not in w and k in src:
                w[k] = src[k]
    return w


class DataSourceWriteConfig(BaseModel):
    """
    通用「可写入 / 同步落地」语义模型；各插件可将对应字段存于 ``connection`` 或其它段，
    由插件在 ``validate_write_config`` 中从扁平字典解析。
    """

    model_config = ConfigDict(extra="ignore")

    write_enabled: bool = False


class DataSourceSpec(ABC):
    """Form schemas and config/datasource behavior for a datasource plugin."""

    def __init__(
        self,
        connection_schema: FormSchema | None = None,
        columns_schema: FormSchema | None = None,
    ) -> None:
        self.connection_schema = connection_schema
        self.columns_schema = columns_schema

    def resolved_connection_secret_keys(self) -> list[str]:
        schema = self.connection_schema
        return schema.resolved_secret_keys() if schema is not None else []

    def resolved_columns_secret_keys(self) -> list[str]:
        schema = self.columns_schema
        return schema.resolved_secret_keys() if schema is not None else []

    def validate_write_config(self, write_config: dict[str, Any]) -> DataSourceWriteConfig:
        """从扁平 ``write_*`` 字典解析并校验通用写入语义（插件可从 ``connection`` 等段组装该字典）。"""
        return DataSourceWriteConfig.model_validate(dict(write_config or {}))

    def list_sync_target_physical_columns(
        self,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
    ) -> list[str] | None:
        """若该类型可作为同步目标并枚举物理列，返回列名；否则返回 ``None``。"""
        _ = connection_config, columns_config
        return None

    def write_sync_dataframe(
        self,
        *,
        connection_config: dict[str, Any],
        columns_config: dict[str, Any],
        df: Any,
    ) -> int:
        """将同步得到的 DataFrame 写入目标；不支持则抛出 ``NotImplementedError``。"""
        _ = connection_config, columns_config, df
        raise NotImplementedError("该数据源类型不支持作为同步写入目标")

    def decrypt_storage_config(self, stored_config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(stored_config or {})
        connection_schema = self.connection_schema
        columns_schema = self.columns_schema
        connection = dict(raw.get("connection") or {})
        columns = dict(raw.get("columns") or {})
        connection = (
            connection_schema.decrypt_form(connection)
            if connection_schema is not None
            else connection
        )
        columns = columns_schema.decrypt_form(columns) if columns_schema is not None else columns
        for k in DATASOURCE_WRITE_FLAT_KEYS:
            if k in columns and k not in connection:
                connection[k] = columns.pop(k)
        legacy_write = dict(raw.get("write") or {})
        for k, v in legacy_write.items():
            if k not in connection:
                connection[k] = v
        return {"connection": connection, "columns": columns}

    def encrypt_storage_config(self, storage_config: dict[str, Any]) -> dict[str, Any]:
        raw = dict(storage_config or {})
        connection_schema = self.connection_schema
        columns_schema = self.columns_schema
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
                self.connection_schema,
                dict(saved_plain.get("connection") or {}),
                connection_overlay,
            ),
            "columns": _merge_part(
                self.columns_schema,
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
    connection_schema = plugin.spec.connection_schema
    columns_schema = plugin.spec.columns_schema
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
    public_config.pop("write", None)
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
