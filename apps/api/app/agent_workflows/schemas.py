"""Pydantic models for agent workflow CRUD and graph persistence."""

from __future__ import annotations

from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field
from workflow import WorkflowGraph, WorkflowLink, WorkflowNode, WorkflowViewport

from app.datetime_utils import utc_now_iso

AgentGraphNode = WorkflowNode
AgentGraphLink = WorkflowLink
AgentGraphViewport = WorkflowViewport
AgentGraphState = WorkflowGraph


class AgentWorkflowRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    graph: AgentGraphState = Field(default_factory=AgentGraphState)
    created_at: str
    updated_at: str


class AgentWorkflowCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    description: str = ""
    graph: AgentGraphState | None = None

    def to_record(self) -> AgentWorkflowRecord:
        now = utc_now_iso()
        return AgentWorkflowRecord(
            id=str(uuid4()),
            name=self.name,
            description=self.description,
            graph=self.graph or AgentGraphState(),
            created_at=now,
            updated_at=now,
        )


class AgentWorkflowPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    graph: AgentGraphState | None = None


class AgentWorkflowSummaryPublic(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    updated_at: str


class AgentWorkflowDetailPublic(BaseModel):
    id: str
    name: str
    description: str
    graph: AgentGraphState
    created_at: str
    updated_at: str


def record_to_summary(rec: AgentWorkflowRecord) -> AgentWorkflowSummaryPublic:
    return AgentWorkflowSummaryPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def record_to_detail(rec: AgentWorkflowRecord) -> AgentWorkflowDetailPublic:
    return AgentWorkflowDetailPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        graph=rec.graph,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )
