from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.http_errors import http_bad_request
from app.scheduler.controller import (
    SchedulerJobNotFoundError,
    SchedulerTaskConflictError,
    SchedulerTaskNotFoundError,
    cancel_job,
    create_task,
    delete_task,
    get_task,
    list_job_logs,
    list_jobs,
    list_tasks,
    trigger_task,
    update_task,
)
from app.scheduler.schemas import (
    CreateSchedulerTaskRequest,
    SchedulerJobLogPublic,
    SchedulerJobPublic,
    SchedulerTaskPublic,
    TriggerSchedulerTaskRequest,
    UpdateSchedulerTaskRequest,
)

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


@router.post("/tasks", response_model=SchedulerTaskPublic)
def create_scheduler_task(body: CreateSchedulerTaskRequest) -> SchedulerTaskPublic:
    try:
        return create_task(body)
    except (ValueError, SchedulerTaskConflictError) as exc:
        http_bad_request(exc)


@router.get("/tasks", response_model=list[SchedulerTaskPublic])
def get_scheduler_tasks(enabled: bool | None = None) -> list[SchedulerTaskPublic]:
    return list_tasks(enabled=enabled)


@router.get("/tasks/{task_id}", response_model=SchedulerTaskPublic)
def get_scheduler_task(task_id: str) -> SchedulerTaskPublic:
    try:
        return get_task(task_id)
    except SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None


@router.patch("/tasks/{task_id}", response_model=SchedulerTaskPublic)
def update_scheduler_task(task_id: str, body: UpdateSchedulerTaskRequest) -> SchedulerTaskPublic:
    try:
        return update_task(task_id, body)
    except SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None
    except (ValueError, SchedulerTaskConflictError) as exc:
        http_bad_request(exc)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_scheduler_task(task_id: str) -> None:
    try:
        delete_task(task_id)
    except SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None


@router.post("/tasks/{task_id}/trigger", response_model=SchedulerJobPublic)
def trigger_scheduler_task(task_id: str, body: TriggerSchedulerTaskRequest) -> SchedulerJobPublic:
    try:
        return trigger_task(task_id, body)
    except SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None
    except ValueError as exc:
        http_bad_request(exc)


@router.get("/jobs", response_model=list[SchedulerJobPublic])
def get_scheduler_jobs(
    task_id: str | None = None,
    status: str | None = None,
    limit: int | None = 50,
) -> list[SchedulerJobPublic]:
    return list_jobs(task_id=task_id, status=status, limit=limit)


@router.post("/jobs/{job_id}/cancel", response_model=SchedulerJobPublic)
def cancel_scheduler_job(job_id: str) -> SchedulerJobPublic:
    try:
        return cancel_job(job_id)
    except SchedulerJobNotFoundError:
        raise HTTPException(status_code=404, detail="任务实例不存在") from None


@router.get("/jobs/{job_id}/logs", response_model=list[SchedulerJobLogPublic])
def get_scheduler_job_logs(job_id: str, limit: int | None = 100) -> list[SchedulerJobLogPublic]:
    return list_job_logs(job_id, limit=limit)
