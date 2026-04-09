from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, field_validator
from workflow import WorkflowGraph

from app.datasource.schemas import utc_now_iso

EvaluationWorkflow = WorkflowGraph

_EMPTY_WORKFLOW: dict[str, Any] = {
    "nodes": [],
    "links": [],
    "workflow_inputs": [],
    "workflow_outputs": [
        {
            "name": "result",
            "required": False,
            "label": "结果",
            "description": "评价工作流最终输出。",
            "value_type": "scalar_json",
            "render_type": "appendable",
        }
    ],
}


def _validate_evaluation_workflow_dict(workflow: dict[str, Any]) -> None:
    if not isinstance(workflow.get("workflow_inputs"), list):
        raise ValueError("workflow 缺少 workflow_inputs")
    if not isinstance(workflow.get("workflow_outputs"), list):
        raise ValueError("workflow 缺少 workflow_outputs")
    nodes = workflow.get("nodes", [])
    if not isinstance(nodes, list):
        raise ValueError("workflow.nodes 必须是数组")
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_type = str(node.get("type", "")).strip()
        if not node_type:
            raise ValueError("workflow.nodes[].type 不能为空")


def workflow_public_dict(workflow_json: str) -> dict[str, Any]:
    """Parse stored workflow string into an object for API responses."""
    raw = workflow_json.strip()
    if not raw:
        return dict(_EMPTY_WORKFLOW)
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("workflow 须为 JSON 对象")
    return data


def _stored_workflow_str(v: object) -> str:
    """Normalize workflow for :class:`EvaluationProfileRecord` (disk / in-memory record)."""
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return json.dumps(dict(_EMPTY_WORKFLOW), ensure_ascii=False)
        loaded = json.loads(s)
        if not isinstance(loaded, dict):
            raise TypeError("workflow 须为 JSON 字符串（对象）")
        _validate_evaluation_workflow_dict(loaded)
        return json.dumps(loaded, ensure_ascii=False)
    raise TypeError("workflow 须为 JSON 字符串（对象）")


def _coerce_workflow_dict(v: object, *, allow_none: bool) -> dict[str, Any] | None:
    if v is None:
        return None if allow_none else dict(_EMPTY_WORKFLOW)
    if isinstance(v, dict):
        _validate_evaluation_workflow_dict(v)
        return v
    raise TypeError("workflow 须为 JSON 对象")


class EvaluationProfileRecord(BaseModel):
    id: str
    name: str
    description: str = ""
    workflow: str
    created_at: str
    updated_at: str

    @field_validator("workflow", mode="before")
    @classmethod
    def _workflow_record(cls, v: object) -> str:
        return _stored_workflow_str(v)


class EvaluationProfileCreate(BaseModel):
    name: str
    description: str = ""
    workflow: dict[str, Any] | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    @field_validator("workflow", mode="before")
    @classmethod
    def _workflow_create(cls, v: object) -> dict[str, Any] | None:
        return _coerce_workflow_dict(v, allow_none=True)

    def to_record(self) -> EvaluationProfileRecord:
        now = utc_now_iso()
        rid = str(uuid4())
        wf = self.workflow if self.workflow is not None else dict(_EMPTY_WORKFLOW)
        return EvaluationProfileRecord(
            id=rid,
            name=self.name.strip(),
            description=self.description.strip(),
            workflow=json.dumps(dict(wf), ensure_ascii=False),
            created_at=now,
            updated_at=now,
        )


class EvaluationProfilePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    workflow: dict[str, Any] | None = None

    @field_validator("workflow", mode="before")
    @classmethod
    def _workflow_patch(cls, v: object) -> dict[str, Any] | None:
        return _coerce_workflow_dict(v, allow_none=True)


class EvaluationProfilePublic(BaseModel):
    id: str
    name: str
    description: str
    workflow: dict[str, Any]
    created_at: str
    updated_at: str


class EvaluationNodeTypePublic(BaseModel):
    type: str
    label: str
    description: str
    category: str | None = None
    inputs: list[dict]
    outputs: list[dict]


class WorkflowIOSpecPublic(BaseModel):
    workflow_inputs: list[dict]
    workflow_outputs: list[dict]
