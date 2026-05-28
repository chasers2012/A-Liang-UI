from __future__ import annotations

import app.tool.controller as tool_controller
from app.startup_jobs import register_startup_job

from .tools import TOOLS


@register_startup_job
def register_backtest_chat_tools() -> None:
    tool_controller.register_tools(
        TOOLS,
        category="回测",
    )
