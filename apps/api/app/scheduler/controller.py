from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.scheduler.exceptions import JobCancelledError
from app.scheduler.models import SchedulerJobLogRow, SchedulerJobRow, SchedulerTaskRow
from app.scheduler.registry import SchedulerRegistry
from app.scheduler.schemas import (
    CreateSchedulerTaskRequest,
    SchedulerJobListResponse,
    SchedulerJobLogPublic,
    SchedulerJobPublic,
    SchedulerTaskPublic,
    TriggerSchedulerTaskRequest,
    UpdateSchedulerTaskRequest,
)
from app.scheduler.utils import (
    next_cron_time,
    next_retry_time,
    normalize_cron_expr,
    utcnow,
    validate_cron_expr,
)


class SchedulerTaskNotFoundError(ValueError):
    pass


class SchedulerJobNotFoundError(ValueError):
    pass


class SchedulerTaskConflictError(ValueError):
    pass


def _task_to_public(row: SchedulerTaskRow) -> SchedulerTaskPublic:
    return SchedulerTaskPublic.model_validate(row, from_attributes=True)


def _job_to_public(row: SchedulerJobRow) -> SchedulerJobPublic:
    return SchedulerJobPublic.model_validate(row, from_attributes=True)


def _log_to_public(row: SchedulerJobLogRow) -> SchedulerJobLogPublic:
    return SchedulerJobLogPublic.model_validate(row, from_attributes=True)


def _append_job_log(
    job_id: str,
    event: str,
    *,
    message: str | None = None,
    extra: dict[str, object] | None = None,
) -> None:
    SchedulerRegistry.append_job_log(
        SchedulerJobLogRow(
            id=uuid4().hex,
            job_id=job_id,
            event=event,
            message=message,
            extra=extra or {},
        )
    )


def _ensure_task_name_unique(name: str, *, exclude_task_id: str | None = None) -> None:
    if SchedulerRegistry.task_name_exists(name, exclude_task_id=exclude_task_id):
        raise SchedulerTaskConflictError(f"任务名称已存在: {name}")


def create_task(body: CreateSchedulerTaskRequest) -> SchedulerTaskPublic:
    cron_expr = normalize_cron_expr(body.cron_expr)
    validate_cron_expr(cron_expr)
    _ensure_task_name_unique(body.name)

    now = utcnow()
    row = SchedulerTaskRow(
        id=uuid4().hex,
        name=body.name,
        task_type=body.task_type,
        cron_expr=cron_expr,
        payload=body.payload,
        enabled=body.enabled,
        max_retries=body.max_retries,
        timeout_seconds=body.timeout_seconds,
        next_run_at=next_cron_time(cron_expr, base_time=now) if cron_expr else None,
        created_at=now,
        updated_at=now,
    )
    return _task_to_public(SchedulerRegistry.create_task(row))


def list_tasks(*, enabled: bool | None = None) -> list[SchedulerTaskPublic]:
    rows = SchedulerRegistry.list_tasks(enabled=enabled)
    return [_task_to_public(r) for r in rows]


def get_task(task_id: str) -> SchedulerTaskPublic:
    row = SchedulerRegistry.get_task(task_id)
    if row is None:
        raise SchedulerTaskNotFoundError(f"任务不存在: {task_id}")
    return _task_to_public(row)


def update_task(task_id: str, body: UpdateSchedulerTaskRequest) -> SchedulerTaskPublic:
    row = SchedulerRegistry.get_task(task_id)
    if row is None:
        raise SchedulerTaskNotFoundError(f"任务不存在: {task_id}")

    patch = body.model_dump(exclude_unset=True)
    if "name" in patch and patch["name"] is not None:
        _ensure_task_name_unique(patch["name"], exclude_task_id=task_id)
        row.name = patch["name"]
    if "task_type" in patch and patch["task_type"] is not None:
        row.task_type = patch["task_type"]
    if "cron_expr" in patch:
        cron_expr = normalize_cron_expr(patch["cron_expr"])
        validate_cron_expr(cron_expr)
        row.cron_expr = cron_expr
        row.next_run_at = next_cron_time(cron_expr, base_time=utcnow()) if cron_expr else None
    if "payload" in patch and patch["payload"] is not None:
        row.payload = patch["payload"]
    if "enabled" in patch and patch["enabled"] is not None:
        row.enabled = patch["enabled"]
    if "max_retries" in patch and patch["max_retries"] is not None:
        row.max_retries = patch["max_retries"]
    if "timeout_seconds" in patch and patch["timeout_seconds"] is not None:
        row.timeout_seconds = patch["timeout_seconds"]
    row.updated_at = utcnow()

    return _task_to_public(SchedulerRegistry.save_task(row))


def delete_task(task_id: str) -> None:
    if not SchedulerRegistry.delete_task(task_id):
        raise SchedulerTaskNotFoundError(f"任务不存在: {task_id}")


def enqueue_job(
    task_id: str,
    *,
    trigger_type: str,
    payload_override: dict[str, object] | None = None,
    dedupe_key: str | None = None,
) -> SchedulerJobPublic:
    now = utcnow()
    task = SchedulerRegistry.get_task_for_enqueue(task_id)
    if task is None:
        raise SchedulerTaskNotFoundError(f"任务不存在: {task_id}")

    merged_payload: dict[str, object] = dict(task.payload)
    if payload_override:
        merged_payload.update(payload_override)

    if dedupe_key:
        existing = SchedulerRegistry.get_active_task_job_by_dedupe_key(
            task_id=task_id, dedupe_key=dedupe_key
        )
        if existing is not None:
            return _job_to_public(existing)

    row = SchedulerRegistry.create_job(
        SchedulerJobRow(
            id=uuid4().hex,
            task_id=task.id,
            task_type=task.task_type,
            trigger_type=trigger_type,
            status="queued",
            attempt=0,
            max_retries=task.max_retries,
            queued_at=now,
            next_run_at=now,
            dedupe_key=dedupe_key,
            timeout_seconds=task.timeout_seconds,
            payload=merged_payload,
        )
    )

    _append_job_log(row.id, "queued", message=f"job queued by {trigger_type}")
    return _job_to_public(row)


def enqueue_oneoff_job(
    *,
    task_type: str,
    trigger_type: str,
    payload: dict[str, object] | None = None,
    max_retries: int = 0,
    timeout_seconds: int = 300,
    dedupe_key: str | None = None,
) -> SchedulerJobPublic:
    now = utcnow()
    if dedupe_key:
        existing = SchedulerRegistry.get_active_oneoff_job_by_dedupe_key(
            task_type=task_type, dedupe_key=dedupe_key
        )
        if existing is not None:
            return _job_to_public(existing)

    row = SchedulerRegistry.create_job(
        SchedulerJobRow(
            id=uuid4().hex,
            task_id=None,
            task_type=task_type,
            trigger_type=trigger_type,
            status="queued",
            attempt=0,
            max_retries=max_retries,
            queued_at=now,
            next_run_at=now,
            dedupe_key=dedupe_key,
            timeout_seconds=timeout_seconds,
            payload=payload or {},
        )
    )

    _append_job_log(row.id, "queued", message=f"one-off job queued by {trigger_type}")
    return _job_to_public(row)


def trigger_task(task_id: str, body: TriggerSchedulerTaskRequest) -> SchedulerJobPublic:
    return enqueue_job(
        task_id,
        trigger_type="manual",
        payload_override=body.payload,
        dedupe_key=body.dedupe_key,
    )


def list_jobs(
    *,
    task_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> SchedulerJobListResponse:
    offset = (page - 1) * page_size
    total, rows = SchedulerRegistry.list_jobs(
        task_id=task_id,
        status=status,
        offset=offset,
        limit=page_size,
    )
    return SchedulerJobListResponse(
        items=[_job_to_public(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def list_job_logs(job_id: str, *, limit: int | None = 100) -> list[SchedulerJobLogPublic]:
    rows = SchedulerRegistry.list_job_logs(job_id, limit=limit)
    return [_log_to_public(r) for r in rows]


def claim_next_job(worker_id: str) -> SchedulerJobPublic | None:
    now = utcnow()
    running_row = SchedulerRegistry.claim_next_job(worker_id=worker_id, now=now)
    if running_row is None:
        return None

    _append_job_log(running_row.id, "running", message=f"claimed by worker {worker_id}")
    return _job_to_public(running_row)


def is_job_cancelled(job_id: str) -> bool:
    row = SchedulerRegistry.get_job(job_id)
    return row is not None and row.status == "cancelled"


def ensure_job_not_cancelled(job_id: str) -> None:
    if is_job_cancelled(job_id):
        raise JobCancelledError(f"任务已取消: {job_id}")


def mark_job_succeeded(job_id: str, result_payload: object) -> SchedulerJobPublic:
    now = utcnow()
    row = SchedulerRegistry.get_job(job_id)
    if row is None:
        raise SchedulerJobNotFoundError(f"任务实例不存在: {job_id}")
    if row.status == "cancelled":
        return _job_to_public(row)
    row.status = "succeeded"
    row.finished_at = now
    row.result = result_payload
    row.last_error = None
    result = _job_to_public(SchedulerRegistry.save_job(row))
    _append_job_log(job_id, "succeeded")
    return result


def mark_job_failed_or_retrying(job_id: str, error_message: str) -> SchedulerJobPublic:
    now = utcnow()
    row = SchedulerRegistry.get_job(job_id)
    if row is None:
        raise SchedulerJobNotFoundError(f"任务实例不存在: {job_id}")
    if row.status == "cancelled":
        return _job_to_public(row)

    row.last_error = error_message
    if row.attempt <= row.max_retries:
        row.status = "retrying"
        row.next_run_at = next_retry_time(row.attempt, base_time=now)
        row.finished_at = None
    else:
        row.status = "failed"
        row.finished_at = now
    result = _job_to_public(SchedulerRegistry.save_job(row))

    if result.status == "retrying":
        _append_job_log(
            job_id,
            "retrying",
            message=error_message,
            extra={
                "attempt": result.attempt,
                "next_run_at": result.next_run_at.isoformat() if result.next_run_at else None,
            },
        )
    else:
        _append_job_log(job_id, "failed", message=error_message)
    return result


def cancel_job(job_id: str) -> SchedulerJobPublic:
    from app.scheduler import execution

    row = SchedulerRegistry.get_job(job_id)
    if row is None:
        raise SchedulerJobNotFoundError(f"任务实例不存在: {job_id}")
    if row.status in {"succeeded", "failed", "cancelled"}:
        return _job_to_public(row)
    was_running = row.status == "running"
    row.status = "cancelled"
    row.finished_at = utcnow()
    result = _job_to_public(SchedulerRegistry.save_job(row))
    _append_job_log(job_id, "cancelled")
    if was_running:
        execution.terminate_running_job(job_id)
    return result


def set_task_next_run(task_id: str, next_run_at: datetime | None) -> None:
    if not SchedulerRegistry.set_task_next_run(
        task_id=task_id, next_run_at=next_run_at, updated_at=utcnow()
    ):
        raise SchedulerTaskNotFoundError(f"任务不存在: {task_id}")


def recover_incomplete_jobs_on_startup() -> int:
    now = utcnow()
    job_ids = SchedulerRegistry.requeue_running_jobs(now=now)
    for job_id in job_ids:
        _append_job_log(
            job_id,
            "retrying",
            message="job recovered after API restart",
            extra={"reason": "api_restart_recovery", "next_run_at": now.isoformat()},
        )
    return len(job_ids)
