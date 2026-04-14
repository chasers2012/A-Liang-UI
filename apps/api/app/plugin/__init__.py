"""Shared building blocks for plugin-style extensions (config schema, redact)."""

from app.plugin.base import Plugin
from app.plugin.redact import redact_config
from app.plugin.registry import (
    PluginRegistry,
    load_plugins_from_entry_points,
)
from app.plugin.schema import PluginConfigSchema
from app.startup_jobs import register_startup_job

__all__ = [
    "Plugin",
    "PluginConfigSchema",
    "PluginRegistry",
    "load_plugins_from_entry_points",
    "redact_config",
]


@register_startup_job
def discover_and_register_plugins() -> None:
    """
    Discover plugins via Python entry points and register them in the shared registry.

    Best-effort: failures should not crash API startup.
    """
    try:
        load_plugins_from_entry_points(PluginRegistry.instance())
    except Exception as e:
        print("error loaing plugin: ", e)
        return
