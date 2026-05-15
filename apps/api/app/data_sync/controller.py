from __future__ import annotations

import contextlib
from datetime import datetime
from uuid import uuid4

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.data_sync.models import DataSyncTaskRow
from app.data_sync.payload import normalize_sync_payload, validate_sync_payload
from app.data_sync.registry import DataSyncRegistry
from app.data_sync.schemas import (
    CreateDataSyncTaskRequest,
    DataSyncJobListResponse,
    DataSyncJobLogPublic,
    DataSyncJobPublic,
    DataSyncTaskPublic,
    TriggerDataSyncTaskRequest,
    UpdateDataSyncTaskRequest,
)
from app.persistence.sqlite_db import get_session
from app.scheduler import controller as scheduler_controller
from app.scheduler.models import SchedulerTaskRow
from app.scheduler.registry import SchedulerRegistry
from app.scheduler.schemas import SchedulerJobPublic
from app.scheduler.utils import next_cron_time, normalize_cron_expr, utcnow, validate_cron_expr


def _task_to_public(row: DataSyncTaskRow) -> DataSyncTaskPublic:
    sched = SchedulerRegistry.get_task(row.id)
    return DataSyncTaskPublic(
        id=row.id,
        name=row.name,
        task_type=DATASOURCE_SYNC_TASK_TYPE,
        cron_expr=row.cron_expr,
        payload=row.payload,
        enabled=row.enabled,
        max_retries=row.max_retries,
        timeout_seconds=row.timeout_seconds,
        next_run_at=sched.next_run_at if sched is not None else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_task_or_raise(task_id: str) -> DataSyncTaskRow:
    row = DataSyncRegistry.get_task(task_id)
    if row is None:
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")
    return row


def _ensure_task_name_unique(name: str, *, exclude_task_id: str | None = None) -> None:
    if DataSyncRegistry.task_name_exists(name, exclude_task_id=exclude_task_id):
        raise scheduler_controller.SchedulerTaskConflictError(f"任务名称已存在: {name}")


def _scheduler_mirror_row(ds: DataSyncTaskRow, *, now: datetime) -> SchedulerTaskRow:
    cron_expr = normalize_cron_expr(ds.cron_expr)
    return SchedulerTaskRow(
        id=ds.id,
        name=ds.name,
        task_type=DATASOURCE_SYNC_TASK_TYPE,
        cron_expr=cron_expr,
        payload={},
        enabled=ds.enabled,
        max_retries=ds.max_retries,
        timeout_seconds=ds.timeout_seconds,
        next_run_at=next_cron_time(cron_expr, base_time=now) if cron_expr else None,
        created_at=now,
        updated_at=now,
    )


def _sync_scheduler_mirror(ds: DataSyncTaskRow) -> None:
    sched = SchedulerRegistry.get_task(ds.id)
    if sched is None:
        return
    cron_expr = normalize_cron_expr(ds.cron_expr)
    now = utcnow()
    sched.name = ds.name
    sched.cron_expr = cron_expr
    sched.enabled = ds.enabled
    sched.max_retries = ds.max_retries
    sched.timeout_seconds = ds.timeout_seconds
    sched.payload = {}
    sched.next_run_at = next_cron_time(cron_expr, base_time=now) if cron_expr else None
    sched.updated_at = now
    SchedulerRegistry.save_task(sched)


def list_tasks(*, enabled: bool | None = None) -> list[DataSyncTaskPublic]:
    return [_task_to_public(r) for r in DataSyncRegistry.list_tasks(enabled=enabled)]


def get_task(task_id: str) -> DataSyncTaskPublic:
    return _task_to_public(_get_task_or_raise(task_id))


def create_task(body: CreateDataSyncTaskRequest) -> DataSyncTaskPublic:
    cron_expr = normalize_cron_expr(body.cron_expr)
    validate_cron_expr(cron_expr)
    _ensure_task_name_unique(body.name)

    payload = normalize_sync_payload(dict(body.payload))
    validate_sync_payload(payload)

    now = utcnow()
    task_id = uuid4().hex
    ds_row = DataSyncTaskRow(
        id=task_id,
        name=body.name,
        cron_expr=cron_expr,
        payload=payload,
        enabled=body.enabled,
        max_retries=body.max_retries,
        timeout_seconds=body.timeout_seconds,
        created_at=now,
        updated_at=now,
    )
    sched_row = _scheduler_mirror_row(ds_row, now=now)

    with get_session() as session:
        session.add(ds_row)
        session.add(sched_row)
        session.commit()
        session.refresh(ds_row)

    return _task_to_public(ds_row)


def update_task(task_id: str, body: UpdateDataSyncTaskRequest) -> DataSyncTaskPublic:
    row = _get_task_or_raise(task_id)
    patch = body.model_dump(exclude_unset=True)

    if "name" in patch and patch["name"] is not None:
        _ensure_task_name_unique(patch["name"], exclude_task_id=task_id)
        row.name = patch["name"]
    if "cron_expr" in patch:
        cron_expr = normalize_cron_expr(patch["cron_expr"])
        validate_cron_expr(cron_expr)
        row.cron_expr = cron_expr
    if "payload" in patch and patch["payload"] is not None:
        payload = normalize_sync_payload(dict(patch["payload"]))
        validate_sync_payload(payload)
        row.payload = payload
    if "enabled" in patch and patch["enabled"] is not None:
        row.enabled = patch["enabled"]
    if "max_retries" in patch and patch["max_retries"] is not None:
        row.max_retries = patch["max_retries"]
    if "timeout_seconds" in patch and patch["timeout_seconds"] is not None:
        row.timeout_seconds = patch["timeout_seconds"]

    row.updated_at = utcnow()
    saved = DataSyncRegistry.save_task(row)
    _sync_scheduler_mirror(saved)
    return _task_to_public(saved)


def delete_task(task_id: str) -> None:
    _get_task_or_raise(task_id)
    with contextlib.suppress(scheduler_controller.SchedulerTaskNotFoundError):
        scheduler_controller.delete_task(task_id)
    if not DataSyncRegistry.delete_task(task_id):
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")


def trigger_task(task_id: str, body: TriggerDataSyncTaskRequest) -> DataSyncJobPublic:
    row = _get_task_or_raise(task_id)
    merged_payload: dict[str, object] = dict(row.payload)
    if body.payload:
        merged_payload.update(body.payload)
    try:
        return scheduler_controller.enqueue_job(
            task_id,
            trigger_type="manual",
            payload_override=merged_payload,
            dedupe_key=body.dedupe_key,
        )
    except scheduler_controller.SchedulerTaskNotFoundError:
        raise scheduler_controller.SchedulerTaskNotFoundError(
            f"数据同步任务不存在: {task_id}"
        ) from None


def _job_row_to_public(job_id: str) -> SchedulerJobPublic:
    row = SchedulerRegistry.get_job(job_id)
    if row is None:
        raise scheduler_controller.SchedulerJobNotFoundError(f"数据同步执行记录不存在: {job_id}")
    job = SchedulerJobPublic.model_validate(row, from_attributes=True)
    if job.task_type != DATASOURCE_SYNC_TASK_TYPE:
        raise scheduler_controller.SchedulerJobNotFoundError(f"数据同步执行记录不存在: {job_id}")
    if job.task_id is not None:
        _get_task_or_raise(job.task_id)
    return job


def list_jobs(
    *,
    task_id: str,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> DataSyncJobListResponse:
    _get_task_or_raise(task_id)
    return scheduler_controller.list_jobs(
        task_id=task_id,
        status=status,
        page=page,
        page_size=page_size,
    )


def list_job_logs(job_id: str, *, limit: int | None = 100) -> list[DataSyncJobLogPublic]:
    _job_row_to_public(job_id)
    return scheduler_controller.list_job_logs(job_id, limit=limit)


def cancel_job(job_id: str) -> DataSyncJobPublic:
    _job_row_to_public(job_id)
    try:
        return scheduler_controller.cancel_job(job_id)
    except scheduler_controller.SchedulerJobNotFoundError:
        raise scheduler_controller.SchedulerJobNotFoundError(
            f"数据同步执行记录不存在: {job_id}"
        ) from None
