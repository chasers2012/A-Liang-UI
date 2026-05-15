from __future__ import annotations

from uuid import uuid4

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
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
from app.scheduler import controller as scheduler_controller
from app.scheduler.models import SchedulerTaskRow
from app.scheduler.schemas import SchedulerJobPublic
from app.scheduler.utils import next_cron_time, normalize_cron_expr, utcnow, validate_cron_expr


def _payload_dict(payload: DataSyncTaskPayload) -> dict[str, object]:
    return payload.model_dump(mode="json", by_alias=True, exclude_none=True)


def _task_to_public(sched: SchedulerTaskRow) -> DataSyncTaskPublic:
    return DataSyncTaskPublic(
        id=sched.id,
        name=sched.name,
        task_type=DATASOURCE_SYNC_TASK_TYPE,
        cron_expr=sched.cron_expr,
        payload=DataSyncTaskPayload.model_validate(sched.payload),
        enabled=sched.enabled,
        max_retries=sched.max_retries,
        timeout_seconds=sched.timeout_seconds,
        next_run_at=sched.next_run_at,
        created_at=sched.created_at,
        updated_at=sched.updated_at,
    )


def list_tasks(*, enabled: bool | None = None) -> list[DataSyncTaskPublic]:
    return [_task_to_public(sched) for sched in DataSyncRegistry.list_tasks(enabled=enabled)]


def get_task(task_id: str) -> DataSyncTaskPublic:
    sched = DataSyncRegistry.get_task(task_id)
    if sched is None:
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")
    return _task_to_public(sched)


def create_task(body: CreateDataSyncTaskRequest) -> DataSyncTaskPublic:
    cron_expr = normalize_cron_expr(body.cron_expr)
    validate_cron_expr(cron_expr)
    if DataSyncRegistry.task_name_exists(body.name):
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

    return _task_to_public(DataSyncRegistry.create_task(sched_row))


def update_task(task_id: str, body: UpdateDataSyncTaskRequest) -> DataSyncTaskPublic:
    sched = DataSyncRegistry.get_task(task_id)
    if sched is None:
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")
    patch = body.model_dump(exclude_unset=True)

    if "name" in patch and patch["name"] is not None:
        if DataSyncRegistry.task_name_exists(patch["name"], exclude_task_id=task_id):
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
        payload = patch["payload"]
        if isinstance(payload, dict):
            payload = DataSyncTaskPayload.model_validate(payload)
        payload.validate_sync_rules()
        sched.payload = _payload_dict(payload)
    if "enabled" in patch and patch["enabled"] is not None:
        sched.enabled = patch["enabled"]
    if "max_retries" in patch and patch["max_retries"] is not None:
        sched.max_retries = patch["max_retries"]
    if "timeout_seconds" in patch and patch["timeout_seconds"] is not None:
        sched.timeout_seconds = patch["timeout_seconds"]

    sched.updated_at = utcnow()

    return _task_to_public(DataSyncRegistry.save_task(sched))


def delete_task(task_id: str) -> None:
    if not DataSyncRegistry.delete_task(task_id):
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")


def trigger_task(task_id: str, body: TriggerDataSyncTaskRequest) -> DataSyncJobPublic:
    sched = DataSyncRegistry.get_task(task_id)
    if sched is None:
        raise scheduler_controller.SchedulerTaskNotFoundError(f"数据同步任务不存在: {task_id}")
    return scheduler_controller.enqueue_job(
        task_id,
        trigger_type="manual",
        payload_override=sched.payload,
        dedupe_key=body.dedupe_key,
    )


def list_jobs(
    *,
    task_id: str,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> DataSyncJobListResponse:
    total, rows = DataSyncRegistry.list_jobs(
        task_id=task_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    return DataSyncJobListResponse(
        items=[SchedulerJobPublic.model_validate(r, from_attributes=True) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def list_job_logs(job_id: str, *, limit: int | None = 100) -> list[DataSyncJobLogPublic]:
    return [
        DataSyncJobLogPublic.model_validate(r, from_attributes=True)
        for r in DataSyncRegistry.list_job_logs(job_id, limit=limit)
    ]


def cancel_job(job_id: str) -> DataSyncJobPublic:
    return DataSyncJobPublic.model_validate(
        scheduler_controller.cancel_job(job_id), from_attributes=True
    )
