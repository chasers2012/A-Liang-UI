from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_backtest_chat_tools() -> None:
    from app.backtest.tools import BACKTEST_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in BACKTEST_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool, category="backtests")
