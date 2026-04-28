from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, field_validator
from workflow import WorkflowGraph
from workflow.schemas import WorkflowGraphPersisted

from app.datasource.schemas import utc_now_iso
from app.evaluation.profile.constants import (
    EVALUATION_EMPTY_WORKFLOW_TEMPLATE,
    empty_workflow_template_dict,
)
from app.evaluation.profile.models import EvaluationProfileRow

EvaluationWorkflow = WorkflowGraph

_EMPTY_WORKFLOW: dict[str, Any] = EVALUATION_EMPTY_WORKFLOW_TEMPLATE


def _normalize_evaluation_workflow_dict(workflow: dict[str, Any]) -> dict[str, Any]:
    return WorkflowGraphPersisted.model_validate(workflow).model_dump(by_alias=True)


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
        return empty_workflow_template_dict()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("workflow 须为 JSON 对象")
    return _normalize_evaluation_workflow_dict(data)


def _stored_workflow_str(v: object) -> str:
    """Normalize workflow for storage rows."""
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return json.dumps(empty_workflow_template_dict(), ensure_ascii=False)
        loaded = json.loads(s)
        if not isinstance(loaded, dict):
            raise TypeError("workflow 须为 JSON 字符串（对象）")
        _validate_evaluation_workflow_dict(loaded)
        return json.dumps(_normalize_evaluation_workflow_dict(loaded), ensure_ascii=False)
    raise TypeError("workflow 须为 JSON 字符串（对象）")


def _coerce_workflow_dict(v: object, *, allow_none: bool) -> dict[str, Any] | None:
    if v is None:
        return None if allow_none else empty_workflow_template_dict()
    if isinstance(v, dict):
        _validate_evaluation_workflow_dict(v)
        return _normalize_evaluation_workflow_dict(v)
    raise TypeError("workflow 须为 JSON 对象")


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

    def to_row(self) -> EvaluationProfileRow:
        now = utc_now_iso()
        rid = str(uuid4())
        wf = (
            _normalize_evaluation_workflow_dict(self.workflow)
            if self.workflow is not None
            else empty_workflow_template_dict()
        )
        return EvaluationProfileRow(
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
