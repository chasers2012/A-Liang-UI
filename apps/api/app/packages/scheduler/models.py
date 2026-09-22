from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlmodel import Column, Field, SQLModel

from app.infra.persistence.sql_types import JsonText


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SchedulerTaskRow(SQLModel, table=True):
    __tablename__ = "scheduler_tasks"

    id: str = Field(primary_key=True)
    name: str = Field(index=True, unique=True)
    task_type: str = Field(index=True)
    cron_expr: str | None = Field(default=None, index=True)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JsonText))
    enabled: bool = Field(default=True, index=True)
    max_retries: int = Field(default=3, ge=0)
    timeout_seconds: int = Field(default=300, ge=1)
    next_run_at: datetime | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow, index=True)


class SchedulerJobRow(SQLModel, table=True):
    __tablename__ = "scheduler_jobs"

    id: str = Field(primary_key=True)
    task_id: str | None = Field(default=None, foreign_key="scheduler_tasks.id", index=True)
    task_type: str = Field(index=True)
    trigger_type: str = Field(index=True)  # cron | manual
    status: str = Field(default="queued", index=True)
    attempt: int = Field(default=0, ge=0)
    max_retries: int = Field(default=3, ge=0)
    queued_at: datetime = Field(default_factory=utcnow, index=True)
    started_at: datetime | None = None
    finished_at: datetime | None = Field(default=None, index=True)
    next_run_at: datetime | None = Field(default=None, index=True)
    dedupe_key: str | None = Field(default=None, index=True)
    worker_id: str | None = Field(default=None, index=True)
    timeout_seconds: int = Field(default=300, ge=1)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JsonText))
    result: Any = Field(default=None, sa_column=Column(JsonText))
    last_error: str | None = None


class SchedulerJobLogRow(SQLModel, table=True):
    __tablename__ = "scheduler_job_logs"

    id: str = Field(primary_key=True)
    job_id: str = Field(foreign_key="scheduler_jobs.id", index=True)
    event: str = Field(index=True)
    message: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JsonText))
    created_at: datetime = Field(default_factory=utcnow, index=True)
