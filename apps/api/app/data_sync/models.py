from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import TEXT, TypeDecorator
from sqlmodel import Column, Field, SQLModel

from app.data_sync.schemas import DataSyncTaskPayload
from app.persistence.json_codec import dumps_json, loads_json


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DataSyncTaskPayloadJson(TypeDecorator):
    """Persist DataSyncTaskPayload as JSON TEXT."""

    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value: Any, dialect) -> str | None:  # type: ignore[override]
        if value is None:
            return None
        if isinstance(value, dict):
            value = DataSyncTaskPayload.model_validate(value)
        if not isinstance(value, DataSyncTaskPayload):
            raise TypeError("payload must be DataSyncTaskPayload or dict")
        data = value.model_dump(mode="json", by_alias=True, exclude_none=True)
        return dumps_json(data)

    def process_result_value(self, value: str | None, dialect) -> DataSyncTaskPayload:  # type: ignore[override]
        if value is None:
            return DataSyncTaskPayload()
        raw = loads_json(value)
        if raw is None:
            return DataSyncTaskPayload()
        return DataSyncTaskPayload.model_validate(raw)


class DataSyncTaskRow(SQLModel, table=True):
    """Canonical storage for data sync task configuration."""

    __tablename__ = "data_sync_tasks"

    id: str = Field(primary_key=True, max_length=64)
    name: str = Field(index=True, unique=True, max_length=100)
    cron_expr: str | None = Field(default=None, index=True, max_length=200)
    payload: DataSyncTaskPayload = Field(
        default_factory=DataSyncTaskPayload,
        sa_column=Column(DataSyncTaskPayloadJson),
    )
    enabled: bool = Field(default=True, index=True)
    max_retries: int = Field(default=3, ge=0)
    timeout_seconds: int = Field(default=300, ge=1)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow, index=True)
