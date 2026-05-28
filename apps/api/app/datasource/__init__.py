"""Workspace datasource registry (SQL/CSV), URL building, column introspection, connectivity checks."""

import app.tool.controller as tool_controller
from app.datasource.tools import TOOLS
from app.startup_jobs import register_startup_job


@register_startup_job
def register_datasource_chat_tools() -> None:
    tool_controller.register_tools(
        TOOLS,
        category="数据源",
    )
