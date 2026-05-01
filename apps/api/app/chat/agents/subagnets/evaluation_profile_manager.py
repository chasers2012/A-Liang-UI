from __future__ import annotations

from typing import Any

from .shared import (
    build_tools,
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


def build_subagent() -> dict[str, Any] | None:

    return {
        "name": "evaluation_profile_manager",
        "description": "用于维护因子评价方案（evaluation profile）资产。因子评价方案是评估因子表现的工作流程。"
        "当任务是创建/更新/查询评价方案、生成评价方案工作流模板，或发起/查询评价运行时应委派给该子代理。",
        "system_prompt": (
            "你是 evaluation_profile_manager 子代理，专注评价方案维护与评价运行管理。"
        ),
        "skills": ["/skills/"],
        **build_tools(TOOL_IDS),
    }
