"""Generic workflow node registry module."""

from __future__ import annotations

import app.tool.controller as tool_controller
from app.startup_jobs import register_startup_job


@register_startup_job
def register_workflow_node_chat_tools() -> None:
    from .tools import TOOLS

    tool_controller.register_tools(
        TOOLS,
        category="节点",
    )
