from __future__ import annotations

from sqlmodel import Field, SQLModel


class WorkflowNodeRow(SQLModel, table=True):
    __tablename__ = "workflow_nodes"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    is_plugin: bool = False
    source_path: str
    created_at: str
    updated_at: str
