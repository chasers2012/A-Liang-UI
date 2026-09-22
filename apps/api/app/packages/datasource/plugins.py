from __future__ import annotations

from typing import ClassVar

from data_source import VerifyResult

from app.infra.plugin.base import Plugin
from app.infra.plugin.registry import PluginRegistry
from app.packages.datasource.schemas import DataSourceSpec

__all__ = [
    "DataSourcePlugin",
    "VerifyResult",
    "get_datasource_plugin",
]


class DataSourcePlugin(Plugin):
    """
    Datasource plugin: validates config, verifies connectivity, builds a DataSource.
    """

    category = "datasource"
    spec: ClassVar[DataSourceSpec]


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
