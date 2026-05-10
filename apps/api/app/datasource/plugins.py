from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import Any, ClassVar

from factor import FactorDataSource

from app.form import FormSchema
from app.plugin.base import Plugin
from app.plugin.registry import PluginRegistry

__all__ = [
    "DataSourcePlugin",
    "VerifyResult",
    "get_datasource_plugin",
    "merge_datasource_config_schemas",
]


@dataclass(frozen=True, slots=True)
class VerifyResult:
    ok: bool
    message: str


class DataSourcePlugin(Plugin):
    """
    Datasource plugin: validates config, verifies connectivity, builds a FactorDataSource.
    """

    category = "datasource"
    connection_config: ClassVar[FormSchema | None] = None
    columns_config: ClassVar[FormSchema | None] = None

    @abstractmethod
    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize config. Must return a JSON-serializable dict."""

    def get_connection_config_schema(self) -> FormSchema | None:
        return self.connection_config

    def get_columns_config_schema(self) -> FormSchema | None:
        return self.columns_config

    @abstractmethod
    def verify(self, config: dict[str, Any]) -> VerifyResult:
        """Check connectivity or readability for the given config."""

    @abstractmethod
    def to_factor_datasource(self, config: dict[str, Any]) -> FactorDataSource:
        """Build a FactorDataSource instance from validated config."""


def merge_datasource_config_schemas(
    connection_config: FormSchema | None,
    columns_config: FormSchema | None,
) -> FormSchema | None:
    """
    Merge connection and columns :class:`FormSchema` for API responses
    and field redaction (e.g. combined ``secret_keys``).
    """
    if connection_config is None and columns_config is None:
        return None
    if connection_config is None:
        return columns_config
    if columns_config is None:
        return connection_config

    conn = connection_config
    cols = columns_config
    conn_props = (
        dict(conn.json_schema.get("properties", {})) if isinstance(conn.json_schema, dict) else {}
    )
    cols_props = (
        dict(cols.json_schema.get("properties", {})) if isinstance(cols.json_schema, dict) else {}
    )
    conn_req = (
        list(conn.json_schema.get("required", [])) if isinstance(conn.json_schema, dict) else []
    )
    cols_req = (
        list(cols.json_schema.get("required", [])) if isinstance(cols.json_schema, dict) else []
    )
    return FormSchema(
        title=conn.title,
        description=conn.description,
        json_schema={
            "type": "object",
            "properties": {**conn_props, **cols_props},
            "required": list(dict.fromkeys([*conn_req, *cols_req])),
        },
        ui_schema={**dict(conn.ui_schema or {}), **dict(cols.ui_schema or {})},
        secret_keys=list(
            dict.fromkeys([*conn.resolved_secret_keys(), *cols.resolved_secret_keys()])
        ),
    )


def get_datasource_plugin(type_id: str) -> DataSourcePlugin:
    """Return the plugin registered for ``type_id`` (must be a :class:`DataSourcePlugin`)."""

    p = PluginRegistry.instance().get("datasource", type_id)
    if not p:
        raise TypeError(f"Plugin {type_id!r} does not exist")
    if not isinstance(p, DataSourcePlugin):
        raise TypeError(
            f"Plugin {type_id!r} is not a DataSourcePlugin (got {type(p).__qualname__})"
        )
    return p
