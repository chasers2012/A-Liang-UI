from __future__ import annotations

from typing import Any

from app.packages.agents.subagent_catalog import get_subagent_catalog_item
from app.packages.agents.tooling import build_tools, resolve_subagent_tool_ids

CATALOG_ITEM = get_subagent_catalog_item("evaluation_profile_manager")
if CATALOG_ITEM is None:
    raise RuntimeError("missing subagent catalog item: evaluation_profile_manager")
TOOL_IDS = set(CATALOG_ITEM.default_tool_ids)


def build_subagent() -> dict[str, Any] | None:

    return {
        "name": "evaluation_profile_manager",
        "description": "用于维护因子评价方案（evaluation profile）资产。因子评价方案是评估因子表现的工作流程。"
        "当任务是创建/更新/查询评价方案、生成评价方案工作流模板，或发起/查询评价运行时应委派给该子代理。",
        "system_prompt": (
            "你是 evaluation_profile_manager 子代理，专注评价方案维护与评价运行管理。"
        ),
        "skills": ["/skills/"],
        **build_tools(resolve_subagent_tool_ids("evaluation_profile_manager", TOOL_IDS)),
    }
