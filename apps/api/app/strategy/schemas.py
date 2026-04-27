from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator
from workflow.schemas import WorkflowGraphPersisted

from app.datasource.schemas import utc_now_iso
from app.strategy.constants import empty_workflow_template_dict
from app.strategy.models import StrategyRow


def workflow_public_dict(workflow_json: str) -> dict[str, Any]:
    raw = (workflow_json or "").strip()
    if not raw:
        return empty_workflow_template_dict()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("workflow 须为 JSON 对象")
    return data


class StrategyCreate(BaseModel):
    name: str
    description: str = ""
    workflow: WorkflowGraphPersisted | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    def to_row(self) -> StrategyRow:
        now = utc_now_iso()
        rid = str(uuid4())
        wf = (
            self.workflow.model_dump(by_alias=True)
            if self.workflow is not None
            else empty_workflow_template_dict()
        )
        return StrategyRow(
            id=rid,
            name=self.name.strip(),
            description=self.description.strip(),
            workflow=json.dumps(wf, ensure_ascii=False),
            created_at=now,
            updated_at=now,
        )


class StrategyPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    workflow: WorkflowGraphPersisted | None = None


class StrategyPublic(BaseModel):
    id: str
    name: str
    description: str
    workflow: WorkflowGraphPersisted
    created_at: str
    updated_at: str


class StrategyListPublic(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    updated_at: str


class WorkflowIOSpecPublic(BaseModel):
    workflow_inputs: list[dict]
    workflow_outputs: list[dict]


class StrategyValidateResponse(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
