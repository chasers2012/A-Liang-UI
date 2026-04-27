from __future__ import annotations

from typing import Any

from app.chat.agents.subagnets.shared import (
    append_tool_boundary_to_description,
    build_subagent_interrupt_on,
    build_subagent_tools,
)

TOOL_IDS = {
    "factor.get_new_factor_template",
    "factor.create_factor",
    "factor.get_factor_detail",
    "factor.get_factor_list",
    "factor.update_factor",
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
        "name": "factor_manager",
        "description": append_tool_boundary_to_description(
            "用于创建和维护量化因子资产。因子是用来解释、预测资产未来收益、风险或行为的一个可计算变量。区别于`指标`,因子的数值需要与资产的未来收益有明确的逻辑正相关性。任何技术面、基本面或其他指标，都应该首先实现为节点，作为因子的上游依赖，而不是直接实现为一个因子。",
            all_tools_by_id,
            tool_ids=TOOL_IDS,
        ),
        "system_prompt": (
            "你是 factor_manager 子代理，负责因子资产维护，完成需求中关于`因子`的部分，其他内容仅作为参考。"
        ),
        "tools": tools,
        "interrupt_on": build_subagent_interrupt_on(
            tools,
            need_authorize_tool_ids=need_authorize_tool_ids,
            all_tools_by_id=all_tools_by_id,
        ),
    }
