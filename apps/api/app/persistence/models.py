from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Column, Index
from sqlmodel import Field, SQLModel

from app.persistence.sql_types import JsonText


class DataSourceRow(SQLModel, table=True):
    __tablename__ = "datasources"

    id: str = Field(primary_key=True)
    name: str
    type: str
    enabled: bool = True
    sql: dict[str, Any] | None = Field(default=None, sa_column=Column(JsonText))
    csv: dict[str, Any] | None = Field(default=None, sa_column=Column(JsonText))
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


class EvaluationMetricRow(SQLModel, table=True):
    __tablename__ = "evaluation_metrics"

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


class ChatSessionRow(SQLModel, table=True):
    __tablename__ = "chat_sessions"

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


Index("ix_chat_messages_session_created", ChatMessageRow.session_id, ChatMessageRow.created_at)
