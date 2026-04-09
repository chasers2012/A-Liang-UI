"""Workspace datasource registry (SQL/CSV), URL building, column introspection, connectivity checks."""

from app.startup_jobs import register_startup_job


@register_startup_job
def register_datasource_chat_tools() -> None:
    from app.chat.tool_registry import ChatToolRegistry
    from app.datasource.tools import DATASOURCE_CHAT_TOOLS

    for tool in DATASOURCE_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)


@register_startup_job
def load_workspace_datasource_plugins() -> None:
    # Best-effort: plugin loading should never crash API startup.
    try:
        from app.datasource.plugin_registry import PluginRegistry
        from app.datasource_plugins_builtin.csv import CSV_PLUGIN
        from app.datasource_plugins_builtin.sql import SQL_PLUGIN

        reg = PluginRegistry.instance()
        # Register built-in plugins first.
        reg.register_many([SQL_PLUGIN, CSV_PLUGIN])
        reg.load_from_workspace()
    except Exception:
        return
