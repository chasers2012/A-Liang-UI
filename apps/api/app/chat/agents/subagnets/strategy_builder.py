from __future__ import annotations

from typing import Any

from app.chat.agents.subagnets.shared import (
    append_tool_boundary_to_description,
    build_subagent_interrupt_on,
    build_subagent_tools,
)

TOOL_IDS = {
    "node.get_formatted_workflow_node",
    "strategy.get_strategy_workflow_template",
    "strategy.get_strategy_node_catalog",
    "strategy.create_strategy",
    "strategy.get_strategy_detail",
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


def build_subagent(
    all_tools_by_id: dict[str, Any],
    *,
    need_authorize_tool_ids: set[str],
) -> dict[str, Any] | None:
    tools = build_subagent_tools(all_tools_by_id, candidate_tool_ids=TOOL_IDS)
    if not tools:
        return None

    return {
        "name": "strategy_builder",
        "description": append_tool_boundary_to_description(
            "用于实现策略查询和编排。以及通过回测评估策略的效果"
            "在本系统中，策略是以工作流形式配置的，每个策略由若干工作流节点构成。策略优先复用通用的工作流节点来实现功能，当现有的节点不能满足要求时，才考虑创建新的节点。"
            "同时该子代理负责策略回测任务的触发与结果查询。",
            all_tools_by_id,
            tool_ids=TOOL_IDS,
        ),
        "system_prompt": (
            "你是 strategy_builder 子代理，专注策略实现与回测执行，仅返回所要求的信息。策略优先复用通用的工作流节点来实现功能，当现有的节点不能满足要求时，需要整理出你要的需求并返回。"
        ),
        "tools": tools,
        "interrupt_on": build_subagent_interrupt_on(
            tools,
            need_authorize_tool_ids=need_authorize_tool_ids,
            all_tools_by_id=all_tools_by_id,
        ),
    }
