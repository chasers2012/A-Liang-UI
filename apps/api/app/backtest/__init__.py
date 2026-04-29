from __future__ import annotations

from app.backtest.tools import TOOLS
from app.startup_jobs import register_startup_job


@register_startup_job
def register_backtest_chat_tools() -> None:
    import app.tool.controller as tool_controller

    tool_controller.register_tools(
        TOOLS,
        category="回测",
    )
