from __future__ import annotations

from sqlalchemy import outerjoin
from sqlmodel import select

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.data_sync.models import DataSyncTaskRow
from app.persistence.sqlite_db import get_session
from app.scheduler.models import SchedulerTaskRow


class DataSyncRegistry:
    @classmethod
    def list_task_pairs(
        cls, *, enabled: bool | None = None
    ) -> list[tuple[SchedulerTaskRow, DataSyncTaskRow]]:
        with get_session() as session:
            task_pairs = (
                select(SchedulerTaskRow, DataSyncTaskRow)
                .select_from(
                    outerjoin(
                        SchedulerTaskRow,
                        DataSyncTaskRow,
                        DataSyncTaskRow.scheduler_task_id == SchedulerTaskRow.id,
                    )
                )
                .where(SchedulerTaskRow.task_type == DATASOURCE_SYNC_TASK_TYPE)
                .order_by(SchedulerTaskRow.created_at.desc())
            )
            if enabled is not None:
                task_pairs = task_pairs.where(SchedulerTaskRow.enabled == enabled)
            return list(session.exec(task_pairs).all())

    @classmethod
    def get_task(cls, scheduler_task_id: str) -> DataSyncTaskRow | None:
        with get_session() as session:
            return session.get(DataSyncTaskRow, scheduler_task_id)

    @classmethod
    def save_task(cls, row: DataSyncTaskRow) -> DataSyncTaskRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def delete_task(cls, scheduler_task_id: str) -> bool:
        with get_session() as session:
            row = session.get(DataSyncTaskRow, scheduler_task_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
