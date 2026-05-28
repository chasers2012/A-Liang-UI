from __future__ import annotations

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


class WorkflowNodeVisibilityRow(SQLModel, table=True):
    __tablename__ = "workflow_node_visibility"

    domain: str = Field(primary_key=True)
    hidden_node_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column("hidden_node_ids", JsonText),
    )
