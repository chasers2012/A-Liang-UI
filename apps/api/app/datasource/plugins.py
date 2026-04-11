from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import Any, ClassVar

from factor import FactorDataSource

from app.plugin.base import Plugin
from app.plugin.schema import PluginConfigSchema

__all__ = [
    "DataSourcePlugin",
    "UnknownDataSourceTypeError",
    "VerifyResult",
    "get_datasource_plugin",
]


@dataclass(frozen=True, slots=True)
class VerifyResult:
    ok: bool
    message: str


class UnknownDataSourceTypeError(RuntimeError):
    def __init__(self, ds_type: str):
        super().__init__(f"Unknown datasource type: {ds_type!r}")
        self.ds_type = ds_type


class DataSourcePlugin(Plugin):
    """
    Datasource plugin: validates config, verifies connectivity, builds a FactorDataSource.
    """

    category = "datasource"
    config: ClassVar[PluginConfigSchema | None] = None

    @abstractmethod
    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Validate and normalize config. Must return a JSON-serializable dict."""

    def get_config_schema(self) -> PluginConfigSchema | None:
        """Optional UI schema for rendering a config form (from class ``config``)."""
        return self.config

    @abstractmethod
    def verify(self, config: dict[str, Any]) -> VerifyResult:
        """Check connectivity or readability for the given config."""

    @abstractmethod
    def to_factor_datasource(self, config: dict[str, Any]) -> FactorDataSource:
        """Build a FactorDataSource instance from validated config."""


def get_datasource_plugin(type_id: str) -> DataSourcePlugin:
    """Return the plugin registered for ``type_id`` (must be a :class:`DataSourcePlugin`)."""
    from app.plugin.registry import PluginRegistry

    p = PluginRegistry.instance().get("datasource", type_id)
    if not isinstance(p, DataSourcePlugin):
        raise TypeError(
            f"Plugin {type_id!r} is not a DataSourcePlugin (got {type(p).__qualname__})"
        )
    return p
