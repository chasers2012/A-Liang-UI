from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator
from workflow.schemas import WorkflowGraphPersisted

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.scheduler.schemas import (
    SchedulerJobListResponse,
    SchedulerJobLogPublic,
    SchedulerJobPublic,
)


class DataSyncTaskPayload(BaseModel):
    """Canonical data-sync task payload (stored on task rows and merged at run time)."""

    model_config = ConfigDict(extra="allow")

    source_datasource_ids: list[str] = Field(default_factory=list)
    target_datasource_ids: list[str] = Field(default_factory=list)
    sync_workflow: WorkflowGraphPersisted | None = None
    initial_start_date: str | None = None
    end_date: str | None = None

    @staticmethod
    def _normalize_datasource_ids(raw: object) -> list[str]:
        if not isinstance(raw, list):
            return []
        out: list[str] = []
        seen: set[str] = set()
        for x in raw:
            s = str(x).strip()
            if not s or s in seen:
                continue
            seen.add(s)
            out.append(s)
        return out

    @staticmethod
    def _workflow_nodes_empty(workflow: dict[str, Any]) -> bool:
        nodes = workflow.get("nodes")
        if not isinstance(nodes, list):
            return True
        return len(nodes) == 0

    @field_validator("source_datasource_ids", "target_datasource_ids", mode="before")
    @classmethod
    def _normalize_id_lists(cls, v: object) -> list[str]:
        return cls._normalize_datasource_ids(v)

    @field_validator("initial_start_date", "end_date", mode="before")
    @classmethod
    def _strip_optional_dates(cls, v: object) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("sync_workflow", mode="before")
    @classmethod
    def _coerce_sync_workflow(cls, v: object) -> WorkflowGraphPersisted | None:
        if v is None:
            return None
        if isinstance(v, WorkflowGraphPersisted):
            return None if cls._workflow_nodes_empty(v.model_dump(by_alias=True)) else v
        if isinstance(v, dict):
            if not v or cls._workflow_nodes_empty(v):
                return None
            return WorkflowGraphPersisted.model_validate(v)
        raise ValueError("sync_workflow 必须是对象")

    @property
    def source_ids(self) -> list[str]:
        return list(self.source_datasource_ids)

    @property
    def target_ids(self) -> list[str]:
        return list(self.target_datasource_ids)

    def normalized_workflow_dict(self) -> dict[str, Any] | None:
        if self.sync_workflow is None:
            return None
        return self.sync_workflow.model_dump(by_alias=True)

    def validate_sync_rules(self) -> None:
        source_ids = self.source_ids
        target_ids = self.target_ids
        if not source_ids:
            raise ValueError("请至少配置一个源数据源（source_datasource_ids）。")
        if not target_ids:
            raise ValueError("请至少配置一个目标数据源（target_datasource_ids）。")
        if set(source_ids) & set(target_ids):
            raise ValueError("源数据源与目标数据源列表不得有交集。")
        if len(source_ids) > 1 and self.sync_workflow is None:
            raise ValueError("多源同步须配置非空的 sync_workflow，以合并/处理多路 DataFrame")

    def workflow_json(self) -> str:
        wf_norm = self.normalized_workflow_dict()
        return json.dumps(wf_norm, ensure_ascii=False) if wf_norm else ""


class DataSyncTargetWriteResult(BaseModel):
    """Per-target write stats from a single sync run."""

    target_datasource_id: str
    rows_written: int = Field(ge=0)


class DataSyncRunResult(BaseModel):
    """Structured result returned by datasource_sync_handler."""

    rows_read: int = Field(ge=0)
    rows_written: int = Field(ge=0)
    rows_written_by_target: list[DataSyncTargetWriteResult] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str
    watermark_date: str | None = None
    source_datasource_ids: list[str] = Field(default_factory=list)
    target_datasource_ids: list[str] = Field(default_factory=list)


class DataSyncTaskBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    cron_expr: str | None = None
    payload: DataSyncTaskPayload = Field(default_factory=DataSyncTaskPayload)
    enabled: bool = True
    max_retries: int = Field(default=3, ge=0, le=20)
    timeout_seconds: int = Field(default=300, ge=1, le=86400)


class CreateDataSyncTaskRequest(DataSyncTaskBase):
    pass


class UpdateDataSyncTaskRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    cron_expr: str | None = None
    payload: DataSyncTaskPayload | None = None
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
    "DataSyncRunResult",
    "DataSyncTargetWriteResult",
    "DataSyncTaskPayload",
    "DataSyncTaskPublic",
    "UpdateDataSyncTaskRequest",
]
