"""Generic workflow node registry module."""

from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_workflow_node_chat_tools() -> None:
    from app.nodes.tools import WORKFLOW_NODE_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in WORKFLOW_NODE_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
