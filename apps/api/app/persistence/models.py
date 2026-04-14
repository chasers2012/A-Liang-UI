from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlmodel import Column, Field, Index, SQLModel

from app.persistence.sql_types import JsonText


class DataSourceRow(SQLModel, table=True):
    __tablename__ = "datasources"

    id: str = Field(primary_key=True)
    name: str
    type: str
    config: dict[str, Any] | None = Field(default=None, sa_column=Column(JsonText))
    created_at: str
    updated_at: str


class FactorRow(SQLModel, table=True):
    __tablename__ = "factors"

    id: str = Field(primary_key=True)
    name: str
    group: str
    description: str
    max_window: int = 1
    dependencies: list[str] = Field(default_factory=list, sa_column=Column(JsonText))
    source_path: str
    created_at: str
    updated_at: str


class EvaluationRunRow(SQLModel, table=True):
    __tablename__ = "evaluation_runs"

    id: str = Field(primary_key=True)
    start_at: datetime
    end_at: datetime
    factor_id: str = Field(index=True)
    error: str | None = None
    evaluation_profile_id: str | None = Field(default=None, index=True)
    results: Any = Field(default=None, sa_column=Column(JsonText))


class WorkflowNodeRow(SQLModel, table=True):
    __tablename__ = "workflow_nodes"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    is_plugin: bool = False
    source_path: str
    created_at: str
    updated_at: str


class WorkflowNodeVisibilityRow(SQLModel, table=True):
    __tablename__ = "workflow_node_visibility"

    domain: str = Field(primary_key=True)
    hidden_node_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column("hidden_node_ids", JsonText),
    )


class PreprocessorRow(SQLModel, table=True):
    __tablename__ = "preprocessors"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    source_path: str
    created_at: str
    updated_at: str


class AgentWorkflowRow(SQLModel, table=True):
    __tablename__ = "agent_workflows"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    graph: str | None = None
    created_at: str
    updated_at: str


class EvaluationProfileRow(SQLModel, table=True):
    __tablename__ = "evaluation_profiles"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    workflow: str
    created_at: str
    updated_at: str


class ChatRow(SQLModel, table=True):
    __tablename__ = "chats"

    id: str = Field(primary_key=True)
    title: str
    message_count: int = 0
    created_at: str
    updated_at: str
    archived_at: str | None = None


class ChatMessageRow(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: str = Field(primary_key=True)
    session_id: str = Field(index=True)
    role: str
    blocks: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JsonText))

    # optional ordering support
    created_at: str | None = Field(default=None, index=True)


class DataSetRow(SQLModel, table=True):
    __tablename__ = "data_sets"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    datasource_bindings: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JsonText)
    )
    # Stored as a serialized workflow graph JSON string:
    # { "nodes": [...], "links": [...] }
    preprocessing_workflow: str = ""
    preprocessors: list[str] = Field(default_factory=list, sa_column=Column(JsonText))
    start: str
    end: str
    instrument_codes: list[str] = Field(default_factory=list, sa_column=Column(JsonText))
    created_at: str
    updated_at: str


class ChatToolRow(SQLModel, table=True):
    __tablename__ = "chat_tools"

    id: str = Field(primary_key=True)
    category: str = ""
    updated_at: str
    disabled: bool = False


Index("ix_chat_messages_session_created", ChatMessageRow.session_id, ChatMessageRow.created_at)
