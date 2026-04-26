from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_backtest_chat_tools() -> None:
    from app.backtest.tools import (
        delete_backtest_run,
        get_backtest_equity,
        get_backtest_node_output,
        get_backtest_run_detail,
        get_backtest_runs,
        get_backtest_trades,
        run_backtest,
    )
    from app.tool.models import ToolAuthorization
    from app.tool.registry import ChatToolRegistry

    tool_defs = [
        ("backtest.run_backtest", run_backtest, ToolAuthorization.allowed),
        ("backtest.get_backtest_runs", get_backtest_runs, ToolAuthorization.allowed),
        ("backtest.get_backtest_run_detail", get_backtest_run_detail, ToolAuthorization.allowed),
        ("backtest.delete_backtest_run", delete_backtest_run, ToolAuthorization.disabled),
        ("backtest.get_backtest_equity", get_backtest_equity, ToolAuthorization.allowed),
        ("backtest.get_backtest_trades", get_backtest_trades, ToolAuthorization.allowed),
        ("backtest.get_backtest_node_output", get_backtest_node_output, ToolAuthorization.allowed),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="回测",
            authorization=authorization,
        )
