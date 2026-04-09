from __future__ import annotations

from pathlib import Path

from app.datasource.plugin_registry import PluginRegistry
from app.datasource_plugins_builtin.csv import CSV_PLUGIN
from app.datasource_plugins_builtin.sql import SQL_PLUGIN


def test_plugin_registry_loads_workspace_plugins(workspace_tmp: Path):
    # Arrange: create a workspace plugin module exporting DATASOURCE_PLUGINS
    plugin_dir = workspace_tmp / "datasource_plugins" / "x"
    plugin_dir.mkdir(parents=True, exist_ok=True)
    plugin_file = plugin_dir / "plugin.py"
    plugin_file.write_text(
        "\n".join(
            [
                "from __future__ import annotations",
                "from typing import Any, Literal",
                "from app.datasource.plugins import DataSourcePlugin, VerifyResult",
                "from factor import FactorDataSource",
                "",
                "class Dummy(FactorDataSource):",
                "    def list_columns(self) -> list[str]:",
                "        return ['a']",
                "    def load_frame(self, *, columns: list[str], filters=None):",
                "        import pandas as pd",
                "        return pd.DataFrame()",
                "",
                "class P(DataSourcePlugin):",
                "    type: Literal['dummy'] = 'dummy'",
                "    def validate_config(self, config: dict[str, Any]) -> dict[str, Any]:",
                "        return dict(config)",
                "    def to_factor_datasource(self, config: dict[str, Any]):",
                "        return Dummy()",
                "    def verify(self, config: dict[str, Any]) -> VerifyResult:",
                "        return VerifyResult(ok=True, message='ok')",
                "",
                "DATASOURCE_PLUGINS = [P()]",
                "",
            ]
        ),
        encoding="utf-8",
    )

    PluginRegistry.reset_instance_for_tests()
    reg = PluginRegistry.instance()
    reg.register_many([SQL_PLUGIN, CSV_PLUGIN])

    # Act
    res = reg.load_from_workspace(root=workspace_tmp)

    # Assert
    assert "dummy" in reg.list_types()
    assert "dummy" in res.registered_types


def test_create_datasource_rejects_invalid_sql_config(client):
    # Missing db_host/db_name/table -> SQL plugin validation error
    r = client.post(
        "/datasources",
        json={
            "name": "bad",
            "type": "sql",
            "enabled": True,
            "config": {},
        },
    )
    assert r.status_code == 400
