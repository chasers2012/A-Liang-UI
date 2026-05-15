from __future__ import annotations

from typing import Any

from sqlalchemy import TEXT, TypeDecorator
from sqlmodel import Column, Field, SQLModel

from app.data_sync.schemas import DataSyncTaskPayload
from app.persistence.json_codec import dumps_json, loads_json


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
    """Data-sync extension; scheduling fields live on scheduler_tasks."""

    __tablename__ = "data_sync_tasks"

    scheduler_task_id: str = Field(
        primary_key=True,
        foreign_key="scheduler_tasks.id",
        max_length=64,
    )
    payload: DataSyncTaskPayload = Field(
        default_factory=DataSyncTaskPayload,
        sa_column=Column(DataSyncTaskPayloadJson),
    )
