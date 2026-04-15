"""Pydantic models for agent workflow CRUD and graph persistence."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.agent_workflows.models import AgentWorkflowRow
from app.common.datetime_utils import utc_now_iso
from app.common.id import create_id_generator

generate_id = create_id_generator("agent_workflows")


class AgentWorkflowCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    description: str = ""
    graph: str | None = None

    def to_row(self) -> AgentWorkflowRow:
        now = utc_now_iso()
        return AgentWorkflowRow(
            id=str(generate_id()),
            name=self.name,
            description=self.description,
            graph=self.graph,
            created_at=now,
            updated_at=now,
        )


class AgentWorkflowPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    graph: str | None = None


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
    graph: str
    created_at: str
    updated_at: str


def row_to_summary(row: AgentWorkflowRow) -> AgentWorkflowSummaryPublic:
    return AgentWorkflowSummaryPublic(
        id=row.id,
        name=row.name,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def row_to_detail(row: AgentWorkflowRow) -> AgentWorkflowDetailPublic:
    return AgentWorkflowDetailPublic(
        id=row.id,
        name=row.name,
        description=row.description,
        graph=row.graph or '{"nodes":[],"links":[]}',
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
