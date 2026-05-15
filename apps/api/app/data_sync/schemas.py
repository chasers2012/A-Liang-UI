from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.scheduler.schemas import (
    SchedulerJobListResponse,
    SchedulerJobLogPublic,
    SchedulerJobPublic,
)


class DataSyncTaskBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    cron_expr: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    max_retries: int = Field(default=3, ge=0, le=20)
    timeout_seconds: int = Field(default=300, ge=1, le=86400)


class CreateDataSyncTaskRequest(DataSyncTaskBase):
    pass


class UpdateDataSyncTaskRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    cron_expr: str | None = None
    payload: dict[str, Any] | None = None
    enabled: bool | None = None
    max_retries: int | None = Field(default=None, ge=0, le=20)
    timeout_seconds: int | None = Field(default=None, ge=1, le=86400)


class DataSyncTaskPublic(DataSyncTaskBase):
    id: str
    task_type: str = Field(default=DATASOURCE_SYNC_TASK_TYPE)
    next_run_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TriggerDataSyncTaskRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)
    dedupe_key: str | None = Field(default=None, max_length=120)


# Job types are identical to scheduler; re-export for a single import surface.
DataSyncJobPublic = SchedulerJobPublic
DataSyncJobListResponse = SchedulerJobListResponse
DataSyncJobLogPublic = SchedulerJobLogPublic

__all__ = [
    "CreateDataSyncTaskRequest",
    "DataSyncJobListResponse",
    "DataSyncJobLogPublic",
    "DataSyncJobPublic",
    "DataSyncTaskPublic",
    "UpdateDataSyncTaskRequest",
]
