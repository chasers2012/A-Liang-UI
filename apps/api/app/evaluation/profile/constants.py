from __future__ import annotations

import json
from typing import Any

EVALUATION_WORKFLOW_INPUTS: list[dict[str, Any]] = [
    {
        "name": "data_set",
        "required": True,
        "label": "数据集",
        "description": "评价所使用的数据集",
        "value_type": "data_set",
        "render_type": "socket",
    },
    {
        "name": "factor",
        "required": True,
        "label": "因子",
        "description": "评价目标因子",
        "value_type": "factor",
        "render_type": "socket",
    },
]

EVALUATION_WORKFLOW_OUTPUTS: list[dict[str, Any]] = [
    {
        "name": "result",
        "required": False,
        "label": "结果",
        "description": "评价工作流最终输出。",
        "value_type": "scalar_json",
        "render_type": "appendable",
    }
]

EVALUATION_EMPTY_WORKFLOW_TEMPLATE: dict[str, Any] = {
    "nodes": [],
    "links": [],
    "workflow_inputs": EVALUATION_WORKFLOW_INPUTS,
    "workflow_outputs": EVALUATION_WORKFLOW_OUTPUTS,
}


def _deep_copy_json_object(value: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(value, ensure_ascii=False))


def empty_workflow_template_dict() -> dict[str, Any]:
    return _deep_copy_json_object(EVALUATION_EMPTY_WORKFLOW_TEMPLATE)


def evaluation_workflow_io_spec_dict() -> dict[str, list[dict[str, Any]]]:
    return {
        "workflow_inputs": _deep_copy_json_object({"workflow_inputs": EVALUATION_WORKFLOW_INPUTS})[
            "workflow_inputs"
        ],
        "workflow_outputs": _deep_copy_json_object(
            {"workflow_outputs": EVALUATION_WORKFLOW_OUTPUTS}
        )["workflow_outputs"],
    }
