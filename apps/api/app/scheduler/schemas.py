from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SchedulerTriggerType = Literal["cron", "manual"]
SchedulerJobStatus = Literal[
    "queued",
    "running",
    "succeeded",
    "failed",
    "retrying",
    "cancelled",
]


class SchedulerTaskBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    task_type: str = Field(min_length=1, max_length=100)
    cron_expr: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    max_retries: int = Field(default=3, ge=0, le=20)
    timeout_seconds: int = Field(default=300, ge=1, le=86400)


class CreateSchedulerTaskRequest(SchedulerTaskBase):
    pass


class UpdateSchedulerTaskRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    task_type: str | None = Field(default=None, min_length=1, max_length=100)
    cron_expr: str | None = None
    payload: dict[str, Any] | None = None
    enabled: bool | None = None
    max_retries: int | None = Field(default=None, ge=0, le=20)
    timeout_seconds: int | None = Field(default=None, ge=1, le=86400)


class SchedulerTaskPublic(SchedulerTaskBase):
    id: str
    next_run_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TriggerSchedulerTaskRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)
    dedupe_key: str | None = Field(default=None, max_length=120)


class SchedulerJobPublic(BaseModel):
    id: str
    task_id: str | None = None
    task_type: str
    trigger_type: SchedulerTriggerType
    status: SchedulerJobStatus
    attempt: int
    max_retries: int
    queued_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    next_run_at: datetime | None = None
    dedupe_key: str | None = None
    worker_id: str | None = None
    timeout_seconds: int
    payload: dict[str, Any] = Field(default_factory=dict)
    result: Any = None
    last_error: str | None = None


class SchedulerJobListResponse(BaseModel):
    items: list[SchedulerJobPublic]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)


class SchedulerJobLogPublic(BaseModel):
    id: str
    job_id: str
    event: str
    message: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
