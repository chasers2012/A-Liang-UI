from __future__ import annotations

from typing import Any

from app.chat.agents.subagnets.shared import (
    append_tool_boundary_to_description,
    build_subagent_interrupt_on,
    build_subagent_tools,
)

TOOL_IDS = {
    "strategy.get_strategy_list",
    "strategy.get_strategy_detail",
    "strategy.load_strategy_detail",
    "datasource.get_datasource_list",
    "datasource.get_datasource_detail",
    "data_set.get_data_set_list",
    "data_set.get_data_set_detail",
    "factor.get_factor_list",
    "factor.get_factor_detail",
    "node.get_workflow_node_list",
    "evaluation_profile.get_evaluation_profile_list",
    "evaluation_run.list_evaluation_runs",
    "backtest.get_backtest_runs",
    "backtest.get_backtest_run_detail",
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
        "name": "advisor",
        "description": append_tool_boundary_to_description(
            (
                "用于获悉系统现状并做简短汇报。"
                "当任务需要先判断系统当前有哪些资源、配置与运行状态时调用。"
            ),
            all_tools_by_id,
            tool_ids=TOOL_IDS,
        ),
        "system_prompt": (
            "你是 advisor 子代理，职责是先通过可用查询工具获悉系统现状，再用简短结论汇报。"
            "汇报优先使用要点式短句，从你取得的数据中筛选出与要求有关的内容返回。"
        ),
        "tools": tools,
        "interrupt_on": build_subagent_interrupt_on(
            tools,
            need_authorize_tool_ids=need_authorize_tool_ids,
            all_tools_by_id=all_tools_by_id,
        ),
    }
