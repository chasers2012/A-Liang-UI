from __future__ import annotations

from app.packages.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.infra.scheduler.models import SchedulerJobLogRow, SchedulerJobRow, SchedulerTaskRow
from app.infra.scheduler.registry import SchedulerRegistry


class DataSyncRegistry:
    @classmethod
    def task_name_exists(cls, name: str, *, exclude_task_id: str | None = None) -> bool:
        return SchedulerRegistry.task_name_exists(name, exclude_task_id=exclude_task_id)

    @classmethod
    def list_tasks(cls, *, enabled: bool | None = None) -> list[SchedulerTaskRow]:
        tasks = SchedulerRegistry.list_tasks(enabled=enabled)
        return [task for task in tasks if task.task_type == DATASOURCE_SYNC_TASK_TYPE]

    @classmethod
    def get_task(cls, scheduler_task_id: str) -> SchedulerTaskRow | None:
        row = SchedulerRegistry.get_task(scheduler_task_id)
        if row is None or row.task_type != DATASOURCE_SYNC_TASK_TYPE:
            return None
        return row

    @classmethod
    def create_task(cls, row: SchedulerTaskRow) -> SchedulerTaskRow:
        return SchedulerRegistry.create_task(row)

    @classmethod
    def save_task(cls, row: SchedulerTaskRow) -> SchedulerTaskRow:
        return SchedulerRegistry.save_task(row)

    @classmethod
    def delete_task(cls, scheduler_task_id: str) -> bool:
        return SchedulerRegistry.delete_task(scheduler_task_id)

    @classmethod
    def list_jobs(
        cls,
        *,
        task_id: str,
        statuses: list[str] | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[int, list[SchedulerJobRow]]:
        return SchedulerRegistry.list_jobs(
            task_id=task_id,
            statuses=statuses,
            offset=(page - 1) * page_size,
            limit=page_size,
        )

    @classmethod
    def list_job_logs(cls, job_id: str, *, limit: int | None = 100) -> list[SchedulerJobLogRow]:
        return SchedulerRegistry.list_job_logs(job_id, limit=limit)
