from __future__ import annotations

from typing import Any

from .shared import (
    build_tools,
)

TOOL_IDS = {
    "factor.get_new_factor_template",
    "factor.create_factor",
    "factor.get_factor_detail",
    "factor.get_factor_list",
    "factor.update_factor",
}


def build_subagent() -> dict[str, Any] | None:

    return {
        "name": "factor_manager",
        "description": "用于创建和维护量化因子资产。因子是用来解释、预测资产未来收益、风险或行为的一个可计算变量。"
        "区别于`指标`,因子的数值需要与资产的未来收益有明确的逻辑正相关性。"
        "任何技术面、基本面或其他指标，都应该首先实现为节点，作为因子的上游依赖，而不是直接实现为一个因子。",
        "system_prompt": (
            "你是 factor_manager 子代理，负责因子资产维护，完成需求中关于`因子`的部分，其他内容仅作为参考。"
            "区别于`指标`,因子的数值需要与资产的未来收益有明确的逻辑正相关性。"
            "任何技术面、基本面或其他指标，都应该首先实现为节点，作为因子的上游依赖，而不是直接实现为一个因子。"
            "你应该拒绝执行任何你的工具功能所不能覆盖的任务。",
        ),
        "skills": ["/skills/"],
        **build_tools(TOOL_IDS),
    }
