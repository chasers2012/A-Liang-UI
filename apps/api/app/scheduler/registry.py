from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, func, or_, update
from sqlmodel import select

from app.persistence.sqlite_db import get_session
from app.scheduler.models import SchedulerJobLogRow, SchedulerJobRow, SchedulerTaskRow


class SchedulerRegistry:
    @classmethod
    def append_job_log(cls, row: SchedulerJobLogRow) -> None:
        with get_session() as session:
            session.add(row)
            session.commit()

    @classmethod
    def task_name_exists(cls, name: str, *, exclude_task_id: str | None = None) -> bool:
        with get_session() as session:
            stmt = select(SchedulerTaskRow).where(SchedulerTaskRow.name == name)
            if exclude_task_id is not None:
                stmt = stmt.where(SchedulerTaskRow.id != exclude_task_id)
            existing = session.exec(stmt).first()
            return existing is not None

    @classmethod
    def create_task(cls, row: SchedulerTaskRow) -> SchedulerTaskRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def list_tasks(cls, *, enabled: bool | None = None) -> list[SchedulerTaskRow]:
        with get_session() as session:
            stmt = select(SchedulerTaskRow).order_by(SchedulerTaskRow.created_at.desc())
            if enabled is not None:
                stmt = stmt.where(SchedulerTaskRow.enabled == enabled)
            return list(session.exec(stmt).all())

    @classmethod
    def get_task(cls, task_id: str) -> SchedulerTaskRow | None:
        with get_session() as session:
            return session.get(SchedulerTaskRow, task_id)

    @classmethod
    def save_task(cls, row: SchedulerTaskRow) -> SchedulerTaskRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def delete_task(cls, task_id: str) -> bool:
        with get_session() as session:
            row = session.get(SchedulerTaskRow, task_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True

    @classmethod
    def get_task_for_enqueue(cls, task_id: str) -> SchedulerTaskRow | None:
        with get_session() as session:
            return session.get(SchedulerTaskRow, task_id)

    @classmethod
    def get_active_task_job_by_dedupe_key(
        cls, *, task_id: str, dedupe_key: str
    ) -> SchedulerJobRow | None:
        with get_session() as session:
            stmt = select(SchedulerJobRow).where(
                and_(
                    SchedulerJobRow.task_id == task_id,
                    SchedulerJobRow.dedupe_key == dedupe_key,
                    SchedulerJobRow.status.in_(["queued", "running", "retrying"]),
                )
            )
            return session.exec(stmt).first()

    @classmethod
    def get_active_oneoff_job_by_dedupe_key(
        cls, *, task_type: str, dedupe_key: str
    ) -> SchedulerJobRow | None:
        with get_session() as session:
            stmt = select(SchedulerJobRow).where(
                and_(
                    SchedulerJobRow.task_id.is_(None),
                    SchedulerJobRow.task_type == task_type,
                    SchedulerJobRow.dedupe_key == dedupe_key,
                    SchedulerJobRow.status.in_(["queued", "running", "retrying"]),
                )
            )
            return session.exec(stmt).first()

    @classmethod
    def create_job(cls, row: SchedulerJobRow) -> SchedulerJobRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def list_jobs(
        cls,
        *,
        task_id: str | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[int, list[SchedulerJobRow]]:
        with get_session() as session:
            filters = []
            if task_id is not None:
                filters.append(SchedulerJobRow.task_id == task_id)
            if status is not None:
                filters.append(SchedulerJobRow.status == status)

            stmt = select(SchedulerJobRow).order_by(SchedulerJobRow.queued_at.desc())
            if filters:
                stmt = stmt.where(*filters)

            count_stmt = select(func.count()).select_from(SchedulerJobRow)
            if filters:
                count_stmt = count_stmt.where(*filters)
            total = session.exec(count_stmt).one()

            rows = list(session.exec(stmt.offset(offset).limit(limit)).all())
            return total, rows

    @classmethod
    def list_job_logs(cls, job_id: str, *, limit: int | None = 100) -> list[SchedulerJobLogRow]:
        with get_session() as session:
            stmt = (
                select(SchedulerJobLogRow)
                .where(SchedulerJobLogRow.job_id == job_id)
                .order_by(SchedulerJobLogRow.created_at.desc())
            )
            if limit is not None:
                stmt = stmt.limit(limit)
            return list(session.exec(stmt).all())

    @classmethod
    def claim_next_job(cls, *, worker_id: str, now: datetime) -> SchedulerJobRow | None:
        with get_session() as session:
            stmt = (
                select(SchedulerJobRow)
                .where(
                    and_(
                        SchedulerJobRow.status.in_(["queued", "retrying"]),
                        or_(
                            SchedulerJobRow.next_run_at.is_(None),
                            SchedulerJobRow.next_run_at <= now,
                        ),
                    )
                )
                .order_by(SchedulerJobRow.queued_at.asc())
                .limit(1)
            )
            row = session.exec(stmt).first()
            if row is None:
                return None

            update_stmt = (
                update(SchedulerJobRow)
                .where(and_(SchedulerJobRow.id == row.id, SchedulerJobRow.status == row.status))
                .values(
                    status="running",
                    worker_id=worker_id,
                    started_at=now,
                    attempt=row.attempt + 1,
                )
            )
            result = session.exec(update_stmt)
            if result.rowcount != 1:
                session.rollback()
                return None

            session.commit()
            return session.get(SchedulerJobRow, row.id)

    @classmethod
    def get_job(cls, job_id: str) -> SchedulerJobRow | None:
        with get_session() as session:
            return session.get(SchedulerJobRow, job_id)

    @classmethod
    def save_job(cls, row: SchedulerJobRow) -> SchedulerJobRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            return row

    @classmethod
    def set_task_next_run(
        cls, *, task_id: str, next_run_at: datetime | None, updated_at: datetime
    ) -> bool:
        with get_session() as session:
            row = session.get(SchedulerTaskRow, task_id)
            if row is None:
                return False
            row.next_run_at = next_run_at
            row.updated_at = updated_at
            session.add(row)
            session.commit()
            return True
