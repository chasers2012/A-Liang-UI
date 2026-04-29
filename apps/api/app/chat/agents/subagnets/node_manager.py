from __future__ import annotations

from typing import Any

from .shared import (
    build_tools,
)

TOOL_IDS = {
    "node.get_new_workflow_node_template",
    "node.create_workflow_node",
    "node.get_workflow_node_detail",
    "node.get_workflow_node_list",
    "node.update_workflow_node",
}


def build_subagent() -> dict[str, Any] | None:

    return {
        "name": "node_manager",
        "description": "用于创建和维护工作流节点资产。"
        "节点是可以在工作流之间复用的最小单元，每个节点都有完整定义的输入、输出和内部逻辑。"
        "目前，使用工作流的模块有：数据集中的数据预处理、因子评价、策略。"
        "以节点并非总是对所有的工作流模块可见，因此你需要明确告知节点要被使用在哪里。"
        "你应该拒绝执行任何你的工具功能所不能覆盖的任务。",
        "system_prompt": (
            "你是 node_manager 子代理，负责工作流节点资产维护，完成需求中关于`节点`的部分，其他内容仅作为参考。"
        ),
        **build_tools(TOOL_IDS),
    }
