from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, field_validator
from workflow import WorkflowGraph

from app.datasources.schemas import utc_now_iso

EvaluationWorkflow = WorkflowGraph

_EMPTY_WORKFLOW: dict[str, Any] = {"nodes": [], "links": [], "viewport": None}


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
        return v
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False)
    raise TypeError("workflow 须为 JSON 字符串或对象")


def _coerce_workflow_dict(v: object, *, allow_none: bool) -> dict[str, Any] | None:
    if v is None:
        return None if allow_none else dict(_EMPTY_WORKFLOW)
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return dict(_EMPTY_WORKFLOW) if not allow_none else None
        data = json.loads(s)
        if not isinstance(data, dict):
            raise ValueError("workflow 须为 JSON 对象")
        return data
    raise TypeError("workflow 须为 JSON 对象或序列化字符串")


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
            workflow=json.dumps(wf, ensure_ascii=False),
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
