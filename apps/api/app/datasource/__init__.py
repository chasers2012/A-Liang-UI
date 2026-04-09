"""Workspace datasource registry (SQL/CSV), URL building, column introspection, connectivity checks."""

from app.startup_jobs import register_startup_job


@register_startup_job
def register_datasource_chat_tools() -> None:
    from app.chat.tool_registry import ChatToolRegistry
    from app.datasource.tools import DATASOURCE_CHAT_TOOLS

    for tool in DATASOURCE_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
