from __future__ import annotations

from uuid import uuid4

from pydantic import BaseModel, Field, field_validator
from workflow import Socket, WorkflowGraph

from app.datasources.schemas import utc_now_iso

EvaluationWorkflow = WorkflowGraph


class EvaluationProfileRecord(BaseModel):
    id: str
    name: str
    description: str = ""
    data_set_id: str | None = None
    workflow: EvaluationWorkflow = Field(default_factory=EvaluationWorkflow)
    is_default: bool = False
    created_at: str
    updated_at: str


class EvaluationProfileCreate(BaseModel):
    name: str
    description: str = ""
    data_set_id: str | None = None
    workflow: EvaluationWorkflow | None = None
    is_default: bool = False

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
        wf = self.workflow or EvaluationWorkflow()
        return EvaluationProfileRecord(
            id=rid,
            name=self.name.strip(),
            description=self.description.strip(),
            data_set_id=(self.data_set_id or "").strip() or None,
            workflow=wf,
            is_default=self.is_default,
            created_at=now,
            updated_at=now,
        )


class EvaluationProfilePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    data_set_id: str | None = None
    workflow: EvaluationWorkflow | None = None
    is_default: bool | None = None


class EvaluationProfilePublic(BaseModel):
    id: str
    name: str
    description: str
    data_set_id: str | None = None
    workflow: EvaluationWorkflow
    is_default: bool
    created_at: str
    updated_at: str


class EvaluationNodeTypePublic(BaseModel):
    type: str
    label: str
    description: str
    category: str | None = None
    inputs: list[Socket]
    outputs: list[Socket]
