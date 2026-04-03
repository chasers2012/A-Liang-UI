"""Workspace data set registry (bindings, date range, symbols) for evaluation."""

from app.startup_jobs import register_startup_job


@register_startup_job
def register_data_set_chat_tools() -> None:
    from app.chat.tool_registry import ChatToolRegistry
    from app.data_set.tools import DATA_SET_CHAT_TOOLS

    for tool in DATA_SET_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
