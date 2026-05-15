from __future__ import annotations

import contextlib
from uuid import uuid4

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.data_sync.models import DataSyncTaskRow
from app.data_sync.registry import DataSyncRegistry
from app.data_sync.schemas import (
    CreateDataSyncTaskRequest,
    DataSyncJobListResponse,
    DataSyncJobLogPublic,
    DataSyncJobPublic,
    DataSyncTaskPayload,
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


def _payload_dict(payload: DataSyncTaskPayload) -> dict[str, object]:
    return payload.model_dump(mode="json", by_alias=True, exclude_none=True)


def _task_to_public(sched: SchedulerTaskRow, ds: DataSyncTaskRow) -> DataSyncTaskPublic:
    return DataSyncTaskPublic(
        id=sched.id,
        name=sched.name,
        task_type=DATASOURCE_SYNC_TASK_TYPE,
        cron_expr=sched.cron_expr,
        payload=ds.payload,
        enabled=sched.enabled,
        max_retries=sched.max_retries,
        timeout_seconds=sched.timeout_seconds,
        next_run_at=sched.next_run_at,
        created_at=sched.created_at,
        updated_at=sched.updated_at,
    )


def _get_pair_or_raise(task_id: str) -> tuple[SchedulerTaskRow, DataSyncTaskRow]:
    sched = SchedulerRegistry.get_task(task_id)
    if sched is None or sched.task_type != DATASOURCE_SYNC_TASK_TYPE:
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")
    ds = DataSyncRegistry.get_task(task_id)
    if ds is None:
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")
    return sched, ds


def list_tasks(*, enabled: bool | None = None) -> list[DataSyncTaskPublic]:
    return [
        _task_to_public(sched, ds)
        for sched, ds in DataSyncRegistry.list_task_pairs(enabled=enabled)
    ]


def get_task(task_id: str) -> DataSyncTaskPublic:
    sched, ds = _get_pair_or_raise(task_id)
    return _task_to_public(sched, ds)


def create_task(body: CreateDataSyncTaskRequest) -> DataSyncTaskPublic:
    cron_expr = normalize_cron_expr(body.cron_expr)
    validate_cron_expr(cron_expr)
    if SchedulerRegistry.task_name_exists(body.name):
        raise scheduler_controller.SchedulerTaskConflictError(f"任务名称已存在: {body.name}")

    body.payload.validate_sync_rules()

    now = utcnow()
    task_id = uuid4().hex
    sched_row = SchedulerTaskRow(
        id=task_id,
        name=body.name,
        task_type=DATASOURCE_SYNC_TASK_TYPE,
        cron_expr=cron_expr,
        payload=_payload_dict(body.payload),
        enabled=body.enabled,
        max_retries=body.max_retries,
        timeout_seconds=body.timeout_seconds,
        next_run_at=next_cron_time(cron_expr, base_time=now) if cron_expr else None,
        created_at=now,
        updated_at=now,
    )
    ds_row = DataSyncTaskRow(scheduler_task_id=task_id, payload=body.payload)

    with get_session() as session:
        session.add(sched_row)
        session.add(ds_row)
        session.commit()
        session.refresh(sched_row)
        session.refresh(ds_row)

    return _task_to_public(sched_row, ds_row)


def update_task(task_id: str, body: UpdateDataSyncTaskRequest) -> DataSyncTaskPublic:
    sched, ds = _get_pair_or_raise(task_id)
    patch = body.model_dump(exclude_unset=True)

    if "name" in patch and patch["name"] is not None:
        if SchedulerRegistry.task_name_exists(patch["name"], exclude_task_id=task_id):
            raise scheduler_controller.SchedulerTaskConflictError(
                f"任务名称已存在: {patch['name']}"
            )
        sched.name = patch["name"]
    if "cron_expr" in patch:
        cron_expr = normalize_cron_expr(patch["cron_expr"])
        validate_cron_expr(cron_expr)
        sched.cron_expr = cron_expr
        sched.next_run_at = next_cron_time(cron_expr, base_time=utcnow()) if cron_expr else None
    if "payload" in patch and patch["payload"] is not None:
        patch["payload"].validate_sync_rules()
        ds.payload = patch["payload"]
        sched.payload = _payload_dict(ds.payload)
    if "enabled" in patch and patch["enabled"] is not None:
        sched.enabled = patch["enabled"]
    if "max_retries" in patch and patch["max_retries"] is not None:
        sched.max_retries = patch["max_retries"]
    if "timeout_seconds" in patch and patch["timeout_seconds"] is not None:
        sched.timeout_seconds = patch["timeout_seconds"]

    sched.updated_at = utcnow()

    with get_session() as session:
        session.add(sched)
        session.add(ds)
        session.commit()
        session.refresh(sched)
        session.refresh(ds)

    return _task_to_public(sched, ds)


def delete_task(task_id: str) -> None:
    _get_pair_or_raise(task_id)
    DataSyncRegistry.delete_task(task_id)
    with contextlib.suppress(scheduler_controller.SchedulerTaskNotFoundError):
        scheduler_controller.delete_task(task_id)


def trigger_task(task_id: str, body: TriggerDataSyncTaskRequest) -> DataSyncJobPublic:
    sched, ds = _get_pair_or_raise(task_id)
    sched.payload = _payload_dict(ds.payload)
    SchedulerRegistry.save_task(sched)
    try:
        return scheduler_controller.enqueue_job(
            task_id,
            trigger_type="manual",
            payload_override=sched.payload,
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
        _get_pair_or_raise(job.task_id)
    return job


def list_jobs(
    *,
    task_id: str,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> DataSyncJobListResponse:
    _get_pair_or_raise(task_id)
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
