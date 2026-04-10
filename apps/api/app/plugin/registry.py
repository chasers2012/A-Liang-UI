from __future__ import annotations

import importlib.metadata
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import ClassVar

from app.plugin.base import Plugin
from app.plugin.constants import PLUGIN_ENTRY_POINT_GROUP


@dataclass(frozen=True, slots=True)
class EntryPointPluginLoadResult:
    loaded_modules: list[str]
    registered_types: list[str]


def _entry_points_for_group(group: str) -> list[importlib.metadata.EntryPoint]:
    eps = importlib.metadata.entry_points()
    # Python 3.10+: EntryPoints has .select(); older versions return dict-like.
    if hasattr(eps, "select"):
        selected = eps.select(group=group)  # type: ignore[attr-defined]
        return sorted(selected, key=lambda ep: (ep.name.lower(), ep.name))
    if isinstance(eps, dict):
        return sorted(eps.get(group, []), key=lambda ep: (ep.name.lower(), ep.name))
    return []


class PluginRegistry:
    """
    Registry keyed by ``plugin.type`` (non-empty string).

    Use ``instance()`` for the shared process-wide registry (datasource plugins).
    """

    _instance: ClassVar[PluginRegistry | None] = None

    def __init__(
        self,
        *,
        on_missing: Callable[[str], BaseException],
        duplicate_message: Callable[[str], str] | None = None,
    ) -> None:
        self._plugins: dict[str, Plugin] = {}
        self._on_missing = on_missing
        self._duplicate_message = duplicate_message or (
            lambda tid: f"Duplicate plugin type registered: {tid!r}"
        )

    def register(self, plugin: Plugin) -> None:
        tid = str(getattr(plugin, "type", "")).strip()
        if not tid:
            raise ValueError("plugin.type must be non-empty")
        if tid in self._plugins:
            raise ValueError(self._duplicate_message(tid))
        self._plugins[tid] = plugin

    def register_many(self, plugins: Iterable[Plugin]) -> None:
        for p in plugins:
            self.register(p)

    def get(self, type_id: str) -> Plugin:
        t = str(type_id).strip()
        if t not in self._plugins:
            raise self._on_missing(t)
        return self._plugins[t]

    def list_types(self) -> list[str]:
        return sorted(self._plugins.keys(), key=lambda x: (x.lower(), x))

    def clear(self) -> None:
        self._plugins.clear()

    @classmethod
    def instance(cls) -> PluginRegistry:
        if PluginRegistry._instance is None:
            from app.datasource.plugins import UnknownDataSourceTypeError

            PluginRegistry._instance = PluginRegistry(
                on_missing=lambda t: UnknownDataSourceTypeError(t),
                duplicate_message=lambda tid: (
                    f"Duplicate datasource plugin type registered: {tid!r}"
                ),
            )
        return PluginRegistry._instance


def load_plugins_from_entry_points(registry: PluginRegistry) -> EntryPointPluginLoadResult:
    """
    Discover plugins via ``importlib.metadata`` entry points.

    - Entry point group is defined by plugin constants.
    - Each entry point should resolve to either a Plugin subclass (class object)
      or a Plugin instance.
    """
    loaded_modules: list[str] = []
    registered: list[str] = []

    for ep in _entry_points_for_group(PLUGIN_ENTRY_POINT_GROUP):
        loaded = ep.load()
        loaded_modules.append(ep.value)

        before = set(registry.list_types())
        plugin: Plugin
        if isinstance(loaded, type) and issubclass(loaded, Plugin):
            plugin = loaded()
        elif isinstance(loaded, Plugin):
            plugin = loaded
        else:
            raise TypeError(
                f"Entry point {ep.name!r} must resolve to a Plugin subclass or instance, "
                f"got {type(loaded).__name__!r}"
            )

        registry.register(plugin)
        after = set(registry.list_types())
        registered.extend(sorted(after - before))

    return EntryPointPluginLoadResult(
        loaded_modules=loaded_modules,
        registered_types=sorted(set(registered), key=lambda x: (x.lower(), x)),
    )
