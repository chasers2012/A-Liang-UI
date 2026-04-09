from __future__ import annotations

from app.startup_jobs import register_startup_job

from . import workflow_node_types  # noqa: F401


@register_startup_job
def register_preprocessor_chat_tools() -> None:
    from app.chat.tool_registry import ChatToolRegistry
    from app.preprocessors.tools import PREPROCESSOR_CHAT_TOOLS

    for tool in PREPROCESSOR_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
