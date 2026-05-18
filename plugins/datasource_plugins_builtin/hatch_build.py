from __future__ import annotations

import sys
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class DuckdbExtensionsBuildHook(BuildHookInterface):
    """Bundle postgres/mysql DuckDB extensions into the wheel at build time."""

    PLUGIN_NAME = "duckdb_extensions"

    def initialize(self, version: str, build_data: dict) -> None:
        root = Path(self.root)
        script = root / "bundle_duckdb_extensions.py"
        if not script.is_file():
            msg = f"bundle script not found: {script}"
            raise OSError(msg)
        import runpy

        print("hatch: bundling DuckDB extensions for datasource-plugins-builtin", file=sys.stderr)
        runpy.run_path(str(script), run_name="__main__")
