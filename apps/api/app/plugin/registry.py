from __future__ import annotations

import importlib.metadata
from collections.abc import Callable, Iterable
from typing import ClassVar

from app.plugin.base import Plugin
from app.plugin.constants import PLUGIN_ENTRY_POINT_GROUP

PluginRegistryKey = tuple[str, str]


def _plugin_registry_key(plugin: Plugin) -> PluginRegistryKey:
    c = str(getattr(plugin, "category", "") or "").strip()
    n = str(getattr(plugin, "name", "") or "").strip()
    if not c:
        raise ValueError("plugin.category must be non-empty")
    if not n:
        raise ValueError("plugin.name must be non-empty")
    return (c, n)


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
    Registry keyed by ``(plugin.category, plugin.name)``.

    Use ``instance()`` for the shared process-wide registry (datasource plugins).
    """

    _instance: ClassVar[PluginRegistry | None] = None

    def __init__(
        self,
        *,
        duplicate_message: Callable[[str, str], str] | None = None,
    ) -> None:
        self._plugins: dict[PluginRegistryKey, Plugin] = {}
        self._duplicate_message = duplicate_message or (
            lambda c, n: f"Duplicate plugin registered: {c!r}/{n!r}"
        )

    def register(self, plugin: Plugin) -> None:
        key = _plugin_registry_key(plugin)
        # if key in self._plugins:
        #     raise ValueError(self._duplicate_message(key[0], key[1]))
        self._plugins[key] = plugin
        plugin.on_registered()

    def register_many(self, plugins: Iterable[Plugin]) -> None:
        for p in plugins:
            self.register(p)

    def get(self, category: str, name: str) -> Plugin:
        key = (str(category).strip(), str(name).strip())
        if not key[0] or not key[1]:
            raise ValueError("category and name must be non-empty")
        if key not in self._plugins:
            return None
        return self._plugins[key]

    def list_registered_by_class(
        self, plugin_cls: type[Plugin]
    ) -> list[tuple[PluginRegistryKey, Plugin]]:
        """
        Return ``(key, plugin)`` for every registered entry whose plugin is an
        instance of ``plugin_cls`` (includes subclasses of ``plugin_cls``).
        ``key`` is ``(category, name)``.
        """
        if not isinstance(plugin_cls, type) or not issubclass(plugin_cls, Plugin):
            raise TypeError(f"plugin_cls must be a Plugin subclass, got {plugin_cls!r}")
        return sorted(
            [(k, p) for k, p in self._plugins.items() if isinstance(p, plugin_cls)],
            key=lambda t: (t[0][0].lower(), t[0][1].lower()),
        )

    def list_registered_by_category(self, category: str) -> list[tuple[str, Plugin]]:
        """
        Return ``(name, plugin)`` for every registered entry in ``category``
        (after stripping ``category``), sorted by ``name``.
        """
        c = str(category).strip()
        if not c:
            raise ValueError("category must be non-empty")
        items = [(k[1], p) for k, p in self._plugins.items() if k[0] == c]
        return sorted(items, key=lambda x: (x[0].lower(), x[0]))

    def list_plugin_names(self, category: str) -> list[str]:
        """Sorted plugin ``name`` values registered under ``category``."""
        return [n for n, _ in self.list_registered_by_category(category)]

    def list_plugin_keys(self) -> list[PluginRegistryKey]:
        """All ``(category, name)`` keys, sorted."""
        return sorted(
            self._plugins.keys(),
            key=lambda k: (k[0].lower(), k[1].lower()),
        )

    def clear(self) -> None:
        self._plugins.clear()

    @classmethod
    def instance(cls) -> PluginRegistry:
        if PluginRegistry._instance is None:
            PluginRegistry._instance = PluginRegistry(
                duplicate_message=lambda cat, name: (
                    f"Duplicate datasource plugin registered: {cat!r}/{name!r}"
                ),
            )
        return PluginRegistry._instance


def load_plugins_from_entry_points(registry: PluginRegistry) -> None:
    """
    Discover plugins via ``importlib.metadata`` entry points.

    - Entry point group is defined by plugin constants.
    - Each entry point should resolve to either a Plugin subclass (class object)
      or a Plugin instance.
    """

    for ep in _entry_points_for_group(PLUGIN_ENTRY_POINT_GROUP):
        try:
            loaded = ep.load()

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

        except Exception as e:
            print(f"Error loading plugin {ep.name}: {e}")
            continue
