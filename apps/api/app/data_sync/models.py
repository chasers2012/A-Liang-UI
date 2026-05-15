from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlmodel import Column, Field, SQLModel

from app.persistence.sql_types import JsonText


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DataSyncTaskRow(SQLModel, table=True):
    """Canonical storage for data sync task configuration."""

    __tablename__ = "data_sync_tasks"

    id: str = Field(primary_key=True, max_length=64)
    name: str = Field(index=True, unique=True, max_length=100)
    cron_expr: str | None = Field(default=None, index=True, max_length=200)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JsonText))
    enabled: bool = Field(default=True, index=True)
    max_retries: int = Field(default=3, ge=0)
    timeout_seconds: int = Field(default=300, ge=1)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow, index=True)
