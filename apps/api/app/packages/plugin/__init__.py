"""Shared building blocks for plugin-style extensions (registry)."""

from __future__ import annotations

import logging

from app.packages.plugin.base import Plugin
from app.packages.plugin.registry import (
    PluginRegistry,
    load_plugins_from_entry_points,
)
from app.startup_jobs import register_startup_job

logger = logging.getLogger(__name__)

__all__ = [
    "Plugin",
    "PluginRegistry",
    "load_plugins_from_entry_points",
]


@register_startup_job
def discover_and_register_plugins() -> None:
    """Discover plugins via Python entry points and register them in the shared registry."""
    try:
        load_plugins_from_entry_points(PluginRegistry.instance())
    except Exception:
        logger.exception("Plugin discovery failed")
