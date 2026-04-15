from __future__ import annotations

from sqlmodel import Field, SQLModel


class AgentWorkflowRow(SQLModel, table=True):
    __tablename__ = "agent_workflows"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    graph: str | None = None
    created_at: str
    updated_at: str
