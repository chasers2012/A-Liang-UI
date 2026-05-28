from __future__ import annotations

import json
from typing import Any

# 预处理工作流节点在节点可见性注册表中的 domain id。
WORKFLOW_PREPROCESSING_DOMAIN: str = "preprocessors"

PREPROCESSING_WORKFLOW_INPUTS: list[dict[str, Any]] = [
    {
        "name": "frames",
        "required": False,
        "label": "原始 frames",
        "description": "由数据集加载原始数据后提供给预处理工作流的 frames 映射。",
        "value_type": "dataframe",
        "render_type": "socket",
    }
]

PREPROCESSING_WORKFLOW_OUTPUTS: list[dict[str, Any]] = [
    {
        "name": "frames",
        "required": True,
        "label": "预处理结果",
        "description": "预处理工作流输出的 DataFrame（将用于构建最终面板）。",
        "value_type": "dataframe",
        "render_type": "socket",
    }
]

PREPROCESSING_EMPTY_WORKFLOW: dict[str, Any] = {
    "nodes": [],
    "links": [],
    "workflow_inputs": PREPROCESSING_WORKFLOW_INPUTS,
    "workflow_outputs": PREPROCESSING_WORKFLOW_OUTPUTS,
}


def _deep_copy_json_object(value: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(value, ensure_ascii=False))


def empty_preprocessing_workflow_dict() -> dict[str, Any]:
    return _deep_copy_json_object(PREPROCESSING_EMPTY_WORKFLOW)


def preprocessing_workflow_io_spec_dict() -> dict[str, list[dict[str, Any]]]:
    return {
        "workflow_inputs": _deep_copy_json_object(
            {"workflow_inputs": PREPROCESSING_WORKFLOW_INPUTS}
        )["workflow_inputs"],
        "workflow_outputs": _deep_copy_json_object(
            {"workflow_outputs": PREPROCESSING_WORKFLOW_OUTPUTS}
        )["workflow_outputs"],
    }
