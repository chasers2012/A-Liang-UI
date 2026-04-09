from __future__ import annotations

import importlib.util
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType

from workspace import get_workspace_root

from app.datasource.plugins import DataSourcePlugin, UnknownDataSourceTypeError


@dataclass(frozen=True, slots=True)
class WorkspacePluginLoadResult:
    loaded_modules: list[str]
    registered_types: list[str]


def _module_name_for_path(path: Path) -> str:
    # Stable-ish module name for a file path; avoids collisions across multiple files.
    return f"app_workspace_datasource_plugin_{abs(hash(str(path.resolve())))}"


def _load_module_from_path(path: Path) -> ModuleType:
    name = _module_name_for_path(path)
    spec = importlib.util.spec_from_file_location(name, str(path))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load plugin module from: {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    return mod


class PluginRegistry:
    _instance: PluginRegistry | None = None

    def __init__(self) -> None:
        self._plugins: dict[str, DataSourcePlugin] = {}

    @classmethod
    def instance(cls) -> PluginRegistry:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, plugin: DataSourcePlugin) -> None:
        ds_type = str(getattr(plugin, "type", "")).strip()
        if not ds_type:
            raise ValueError("plugin.type must be non-empty")
        if ds_type in self._plugins:
            raise ValueError(f"Duplicate datasource plugin type registered: {ds_type!r}")
        self._plugins[ds_type] = plugin

    def register_many(self, plugins: Iterable[DataSourcePlugin]) -> None:
        for p in plugins:
            self.register(p)

    def get(self, ds_type: str) -> DataSourcePlugin:
        t = str(ds_type).strip()
        if t not in self._plugins:
            raise UnknownDataSourceTypeError(t)
        return self._plugins[t]

    def list_types(self) -> list[str]:
        return sorted(self._plugins.keys(), key=lambda x: (x.lower(), x))

    def clear(self) -> None:
        self._plugins.clear()

    @classmethod
    def reset_instance_for_tests(cls) -> None:
        cls._instance = None

    def load_from_workspace(self, *, root: Path | None = None) -> WorkspacePluginLoadResult:
        """
        Load datasource plugins from workspace directory.

        Convention:
        - Scan `<workspace>/datasource_plugins/**/plugin.py` and `__init__.py`
        - Each module must export `DATASOURCE_PLUGINS: list[DataSourcePlugin]`
        """
        ws_root = root or get_workspace_root()
        base = (ws_root / "datasource_plugins").resolve()
        if not base.exists() or not base.is_dir():
            return WorkspacePluginLoadResult(loaded_modules=[], registered_types=[])

        candidates: list[Path] = []
        candidates.extend(sorted(base.rglob("plugin.py")))
        candidates.extend(sorted(base.rglob("__init__.py")))

        loaded_modules: list[str] = []
        registered: list[str] = []

        for fp in candidates:
            mod = _load_module_from_path(fp)
            loaded_modules.append(mod.__name__)
            plugins = getattr(mod, "DATASOURCE_PLUGINS", None)
            if plugins is None:
                continue
            if not isinstance(plugins, list):
                raise TypeError(f"{fp} DATASOURCE_PLUGINS must be a list")
            before = set(self._plugins.keys())
            self.register_many(plugins)
            after = set(self._plugins.keys())
            registered.extend(sorted(after - before))

        return WorkspacePluginLoadResult(
            loaded_modules=loaded_modules,
            registered_types=sorted(set(registered), key=lambda x: (x.lower(), x)),
        )
