from __future__ import annotations

import json
from typing import Any

# 策略工作流节点在节点可见性注册表中的 domain id。
WORKFLOW_STRATEGY_DOMAIN: str = "strategy"

STRATEGY_WORKFLOW_INPUTS: list[dict[str, Any]] = [
    {
        "name": "data_set",
        "required": True,
        "label": "数据集ID",
        "description": "策略计算与回测使用的数据集 ID",
        "value_type": "data_set",
        "render_type": "socket",
    },
]

STRATEGY_WORKFLOW_OUTPUTS: list[dict[str, Any]] = [
    {
        "name": "position",
        "required": True,
        "label": "持仓",
        "description": "MultiIndex(date, asset) 的持仓矩阵。",
        "value_type": "position_df",
        "render_type": "socket",
    },
]

STRATEGY_EMPTY_WORKFLOW_TEMPLATE: dict[str, Any] = {
    "nodes": [],
    "links": [],
    "workflow_inputs": STRATEGY_WORKFLOW_INPUTS,
    "workflow_outputs": STRATEGY_WORKFLOW_OUTPUTS,
}


def _deep_copy_json_object(value: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(value, ensure_ascii=False))


def empty_workflow_template_dict() -> dict[str, Any]:
    return _deep_copy_json_object(STRATEGY_EMPTY_WORKFLOW_TEMPLATE)


def strategy_workflow_template_dict() -> dict[str, Any]:
    return empty_workflow_template_dict()


def strategy_workflow_io_spec_dict() -> dict[str, list[dict[str, Any]]]:
    return {
        "workflow_inputs": _deep_copy_json_object({"workflow_inputs": STRATEGY_WORKFLOW_INPUTS})[
            "workflow_inputs"
        ],
        "workflow_outputs": _deep_copy_json_object({"workflow_outputs": STRATEGY_WORKFLOW_OUTPUTS})[
            "workflow_outputs"
        ],
    }
