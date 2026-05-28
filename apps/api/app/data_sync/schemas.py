from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
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
    start_date: str | None = None
    end_date: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce_legacy_start_date(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        if data.get("start_date"):
            return data
        legacy = data.get("initial_start_date")
        if not legacy:
            return data
        out = dict(data)
        out["start_date"] = legacy
        return out

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

    @field_validator("source_datasource_ids", "target_datasource_ids", mode="before")
    @classmethod
    def _normalize_id_lists(cls, v: object) -> list[str]:
        return cls._normalize_datasource_ids(v)

    @field_validator("start_date", "end_date", mode="before")
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
            return v
        if isinstance(v, dict):
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
            raise ValueError("请至少选择一个源数据源。")
        if not target_ids:
            raise ValueError("请至少选择一个目标数据源。")
        if set(source_ids) & set(target_ids):
            raise ValueError("源数据源与目标数据源不得重复。")
        from app.datasource.registry import DataSourceItemsRegistry
        from app.datasource.schemas import datasource_write_enabled

        for tid in target_ids:
            row = DataSourceItemsRegistry.get_item(tid)
            if row is None:
                continue
            if not datasource_write_enabled(row):
                raise ValueError("目标数据源须为已开启写入的数据源。")
        if len(source_ids) > 1 and self.sync_workflow is None:
            raise ValueError("多源同步须配置非空的 sync_workflow，以合并/处理多路 DataFrame")
        if not self.start_date:
            raise ValueError("请配置起始日期。")

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


class DataSyncTaskPayloadPatch(BaseModel):
    """Partial payload for PATCH; only fields present in the request body are applied."""

    model_config = ConfigDict(extra="allow")

    source_datasource_ids: list[str] | None = None
    target_datasource_ids: list[str] | None = None
    sync_workflow: WorkflowGraphPersisted | None = None
    start_date: str | None = None
    end_date: str | None = None

    @field_validator("source_datasource_ids", "target_datasource_ids", mode="before")
    @classmethod
    def _normalize_id_lists(cls, v: object) -> list[str] | None:
        if v is None:
            return None
        return DataSyncTaskPayload._normalize_datasource_ids(v)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def _strip_optional_dates(cls, v: object) -> str | None:
        return DataSyncTaskPayload._strip_optional_dates(v)

    @field_validator("sync_workflow", mode="before")
    @classmethod
    def _coerce_sync_workflow(cls, v: object) -> WorkflowGraphPersisted | None:
        return DataSyncTaskPayload._coerce_sync_workflow(v)


class UpdateDataSyncTaskRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    cron_expr: str | None = None
    payload: DataSyncTaskPayloadPatch | None = None
    enabled: bool | None = None
    max_retries: int | None = Field(default=None, ge=0, le=20)
    timeout_seconds: int | None = Field(default=None, ge=1, le=86400)


class DataSyncDatasourceRef(BaseModel):
    """Resolved datasource metadata for API responses (not persisted on task rows)."""

    id: str
    name: str = ""
    type: str = ""


class DataSyncTaskPublic(DataSyncTaskBase):
    id: str
    task_type: str = Field(default=DATASOURCE_SYNC_TASK_TYPE)
    next_run_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    source_datasource_refs: list[DataSyncDatasourceRef] = Field(default_factory=list)
    target_datasource_refs: list[DataSyncDatasourceRef] = Field(default_factory=list)


class TriggerDataSyncTaskRequest(BaseModel):
    dedupe_key: str | None = Field(default=None, max_length=120)


# Job types are identical to scheduler; re-export for a single import surface.
DataSyncJobPublic = SchedulerJobPublic
DataSyncJobListResponse = SchedulerJobListResponse
DataSyncJobLogPublic = SchedulerJobLogPublic

__all__ = [
    "CreateDataSyncTaskRequest",
    "DataSyncDatasourceRef",
    "DataSyncJobListResponse",
    "DataSyncJobLogPublic",
    "DataSyncJobPublic",
    "DataSyncRunResult",
    "DataSyncTargetWriteResult",
    "DataSyncTaskPayload",
    "DataSyncTaskPayloadPatch",
    "DataSyncTaskPublic",
    "UpdateDataSyncTaskRequest",
]
