from __future__ import annotations

from uuid import uuid4

from pydantic import BaseModel, field_validator
from workflow import WorkflowGraph

from app.datasources.schemas import utc_now_iso

EvaluationWorkflow = WorkflowGraph


class EvaluationProfileRecord(BaseModel):
    id: str
    name: str
    description: str = ""
    workflow: str
    created_at: str
    updated_at: str


class EvaluationProfileCreate(BaseModel):
    name: str
    description: str = ""
    workflow: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("name 不能为空")
        return s

    def to_record(self) -> EvaluationProfileRecord:
        now = utc_now_iso()
        rid = str(uuid4())
        wf = self.workflow
        return EvaluationProfileRecord(
            id=rid,
            name=self.name.strip(),
            description=self.description.strip(),
            workflow=wf,
            created_at=now,
            updated_at=now,
        )


class EvaluationProfilePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    workflow: str | None = None


class EvaluationProfilePublic(BaseModel):
    id: str
    name: str
    description: str
    workflow: str
    created_at: str
    updated_at: str


class EvaluationNodeTypePublic(BaseModel):
    type: str
    label: str
    description: str
    category: str | None = None
    inputs: list[dict]
    outputs: list[dict]
