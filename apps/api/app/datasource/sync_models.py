from __future__ import annotations

from sqlmodel import Field, SQLModel

from app.common.datetime_utils import utc_now_iso


class DataSourceSyncCursorRow(SQLModel, table=True):
    """Per-scheduler-task (or explicit cursor_key) watermark for incremental datasource sync."""

    __tablename__ = "datasource_sync_cursors"

    cursor_key: str = Field(primary_key=True, max_length=200)
    scheduler_task_id: str | None = Field(default=None, max_length=64, index=True)
    source_datasource_id: str = Field(max_length=64, index=True)
    target_datasource_id: str = Field(max_length=64, index=True)
    # JSON arrays of datasource ids (stable sorted). Null = legacy single source/target only.
    source_ids_json: str | None = Field(default=None)
    target_ids_json: str | None = Field(default=None)
    # Max value of source date_column seen in the last successful batch (inclusive).
    watermark_date: str | None = Field(default=None, max_length=64)
    updated_at: str = Field(default_factory=utc_now_iso)
