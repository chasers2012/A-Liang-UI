from __future__ import annotations

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.data_sync.payload import normalize_sync_payload, validate_sync_payload
from app.data_sync.schemas import (
    CreateDataSyncTaskRequest,
    DataSyncJobListResponse,
    DataSyncJobLogPublic,
    DataSyncJobPublic,
    DataSyncTaskPublic,
    TriggerDataSyncTaskRequest,
    UpdateDataSyncTaskRequest,
)
from app.scheduler import controller as scheduler_controller
from app.scheduler.registry import SchedulerRegistry
from app.scheduler.schemas import (
    CreateSchedulerTaskRequest,
    SchedulerJobPublic,
    SchedulerTaskPublic,
    TriggerSchedulerTaskRequest,
    UpdateSchedulerTaskRequest,
)


class DataSyncTaskNotFoundError(ValueError):
    pass


class DataSyncJobNotFoundError(ValueError):
    pass


def _task_to_public(row: SchedulerTaskPublic) -> DataSyncTaskPublic:
    return DataSyncTaskPublic(
        id=row.id,
        name=row.name,
        task_type=row.task_type,
        cron_expr=row.cron_expr,
        payload=row.payload,
        enabled=row.enabled,
        max_retries=row.max_retries,
        timeout_seconds=row.timeout_seconds,
        next_run_at=row.next_run_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _ensure_sync_task(row: SchedulerTaskPublic, *, task_id: str | None = None) -> None:
    if row.task_type != DATASOURCE_SYNC_TASK_TYPE:
        label = task_id or row.id
        raise DataSyncTaskNotFoundError(f"数据同步任务不存在: {label}")


def _get_sync_task_or_raise(task_id: str) -> SchedulerTaskPublic:
    try:
        row = scheduler_controller.get_task(task_id)
    except scheduler_controller.SchedulerTaskNotFoundError:
        raise DataSyncTaskNotFoundError(f"数据同步任务不存在: {task_id}") from None
    _ensure_sync_task(row, task_id=task_id)
    return row


def list_tasks(*, enabled: bool | None = None) -> list[DataSyncTaskPublic]:
    rows = scheduler_controller.list_tasks(enabled=enabled)
    return [_task_to_public(r) for r in rows if r.task_type == DATASOURCE_SYNC_TASK_TYPE]


def get_task(task_id: str) -> DataSyncTaskPublic:
    return _task_to_public(_get_sync_task_or_raise(task_id))


def create_task(body: CreateDataSyncTaskRequest) -> DataSyncTaskPublic:
    payload = normalize_sync_payload(dict(body.payload))
    validate_sync_payload(payload)
    created = scheduler_controller.create_task(
        CreateSchedulerTaskRequest(
            name=body.name,
            task_type=DATASOURCE_SYNC_TASK_TYPE,
            cron_expr=body.cron_expr,
            payload=payload,
            enabled=body.enabled,
            max_retries=body.max_retries,
            timeout_seconds=body.timeout_seconds,
        )
    )
    return _task_to_public(created)


def update_task(task_id: str, body: UpdateDataSyncTaskRequest) -> DataSyncTaskPublic:
    _get_sync_task_or_raise(task_id)
    patch = body.model_dump(exclude_unset=True)
    if "payload" in patch and patch["payload"] is not None:
        payload = normalize_sync_payload(dict(patch["payload"]))
        validate_sync_payload(payload)
        patch["payload"] = payload
    try:
        updated = scheduler_controller.update_task(
            task_id,
            UpdateSchedulerTaskRequest(**patch),
        )
    except scheduler_controller.SchedulerTaskNotFoundError:
        raise DataSyncTaskNotFoundError(f"数据同步任务不存在: {task_id}") from None
    _ensure_sync_task(updated, task_id=task_id)
    return _task_to_public(updated)


def delete_task(task_id: str) -> None:
    _get_sync_task_or_raise(task_id)
    try:
        scheduler_controller.delete_task(task_id)
    except scheduler_controller.SchedulerTaskNotFoundError:
        raise DataSyncTaskNotFoundError(f"数据同步任务不存在: {task_id}") from None


def trigger_task(task_id: str, body: TriggerDataSyncTaskRequest) -> DataSyncJobPublic:
    _get_sync_task_or_raise(task_id)
    try:
        return scheduler_controller.trigger_task(
            task_id,
            TriggerSchedulerTaskRequest(payload=body.payload, dedupe_key=body.dedupe_key),
        )
    except scheduler_controller.SchedulerTaskNotFoundError:
        raise DataSyncTaskNotFoundError(f"数据同步任务不存在: {task_id}") from None


def _job_row_to_public(job_id: str) -> SchedulerJobPublic:
    row = SchedulerRegistry.get_job(job_id)
    if row is None:
        raise DataSyncJobNotFoundError(f"数据同步执行记录不存在: {job_id}")
    job = SchedulerJobPublic.model_validate(row, from_attributes=True)
    if job.task_type != DATASOURCE_SYNC_TASK_TYPE:
        raise DataSyncJobNotFoundError(f"数据同步执行记录不存在: {job_id}")
    if job.task_id is not None:
        _get_sync_task_or_raise(job.task_id)
    return job


def list_jobs(
    *,
    task_id: str,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> DataSyncJobListResponse:
    _get_sync_task_or_raise(task_id)
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
        raise DataSyncJobNotFoundError(f"数据同步执行记录不存在: {job_id}") from None
