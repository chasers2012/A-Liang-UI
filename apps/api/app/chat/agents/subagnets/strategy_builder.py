from __future__ import annotations

from typing import Any

from app.chat.agents.subagnets.shared import (
    build_tools,
)
from deepagents import FilesystemPermission

TOOL_IDS = {
    "strategy.get_strategy_workflow_template",
    "strategy.get_strategy_node_catalog",
    "strategy.get_strategy_workflow_draft",
    "strategy.create_strategy",
    "strategy.get_strategy_detail",
    "strategy.load_strategy_detail",
    "strategy.get_strategy_list",
    "strategy.update_strategy",
    "strategy.workflow.add_node",
    "strategy.workflow.draft_node",
    "strategy.workflow.remove_node",
    "strategy.workflow.update_node_metadata",
    "strategy.workflow.move_node",
    "strategy.workflow.set_node_param",
    "strategy.workflow.unset_node_param",
    "strategy.workflow.connect_nodes",
    "strategy.workflow.connect_input",
    "strategy.workflow.connect_output",
    "strategy.workflow.disconnect_link",
    "strategy.workflow.disconnect_between",
    "backtest.run_backtest",
    "backtest.get_backtest_runs",
    "backtest.get_backtest_run_detail",
    "backtest.get_backtest_equity",
    "backtest.get_backtest_trades",
    "backtest.get_backtest_node_output",
}


def build_subagent() -> dict[str, Any]:

    return {
        "name": "strategy-manager",
        "description": "用于创建策略、查询策略、修改策略。以及通过回测评估策略的效果。"
        "你必须将任何与策略或回测有关的任务委派给此子代理。你必须通过此子代理了解任何与策略或回测有关的细节。"
        "同时该子代理负责策略回测任务的触发与结果查询。",
        "system_prompt": (
            "你是 strategy-manager 子代理，专注策略实现与回测执行，仅返回所要求的信息。"
            "你应该拒绝执行任何你的工具功能所不能覆盖的任务。"
            "你应该在信息不足时要求补充。"
        ),
        "permissions": [
            FilesystemPermission(
                operations=["write", "read"],
                paths=["/**"],
                mode="deny",
            ),
        ],
        **build_tools(TOOL_IDS),
    }
