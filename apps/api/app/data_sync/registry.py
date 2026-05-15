from __future__ import annotations

from sqlmodel import select

from app.data_sync.models import DataSyncTaskRow
from app.persistence.sqlite_db import get_session


class DataSyncRegistry:
    @classmethod
    def task_name_exists(cls, name: str, *, exclude_task_id: str | None = None) -> bool:
        with get_session() as session:
            stmt = select(DataSyncTaskRow).where(DataSyncTaskRow.name == name)
            if exclude_task_id is not None:
                stmt = stmt.where(DataSyncTaskRow.id != exclude_task_id)
            return session.exec(stmt).first() is not None

    @classmethod
    def list_tasks(cls, *, enabled: bool | None = None) -> list[DataSyncTaskRow]:
        with get_session() as session:
            stmt = select(DataSyncTaskRow).order_by(DataSyncTaskRow.created_at.desc())
            if enabled is not None:
                stmt = stmt.where(DataSyncTaskRow.enabled == enabled)
            return list(session.exec(stmt).all())

    @classmethod
    def get_task(cls, task_id: str) -> DataSyncTaskRow | None:
        with get_session() as session:
            return session.get(DataSyncTaskRow, task_id)

    @classmethod
    def save_task(cls, row: DataSyncTaskRow) -> DataSyncTaskRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def delete_task(cls, task_id: str) -> bool:
        with get_session() as session:
            row = session.get(DataSyncTaskRow, task_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
