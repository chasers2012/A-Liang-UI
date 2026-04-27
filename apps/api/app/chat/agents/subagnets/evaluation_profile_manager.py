from __future__ import annotations

from typing import Any

from app.chat.agents.subagnets.shared import (
    append_tool_boundary_to_description,
    build_subagent_interrupt_on,
    build_subagent_tools,
)

TOOL_IDS = {
    "evaluation_profile.get_evaluation_profile_workflow_template",
    "evaluation_profile.get_workflow_node_types_source",
    "evaluation_profile.create_evaluation_profile",
    "evaluation_profile.get_evaluation_profile_detail",
    "evaluation_profile.get_evaluation_profile_list",
    "evaluation_profile.update_evaluation_profile",
    "evaluation_run.run_evaluation_run",
    "evaluation_run.list_evaluation_runs",
    "evaluation_run.get_evaluation_run_detail",
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
        "name": "evaluation_profile_manager",
        "description": append_tool_boundary_to_description(
            (
                "用于维护因子评价方案（evaluation profile）资产。因子评价方案是评估因子表现的工作流程。"
                "当任务是创建/更新/查询评价方案、生成评价方案工作流模板，或发起/查询评价运行时应委派给该子代理。"
            ),
            all_tools_by_id,
            tool_ids=TOOL_IDS,
        ),
        "system_prompt": (
            "你是 evaluation_profile_manager 子代理，专注评价方案维护与评价运行管理。"
        ),
        "tools": tools,
        "interrupt_on": build_subagent_interrupt_on(
            tools,
            need_authorize_tool_ids=need_authorize_tool_ids,
            all_tools_by_id=all_tools_by_id,
        ),
    }
