from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.http_errors import http_bad_request
from app.query_params import parse_csv_query
from app.scheduler.schemas import (
    CreateSchedulerTaskRequest,
    SchedulerJobListResponse,
    SchedulerJobLogPublic,
    SchedulerJobPublic,
    SchedulerTaskPublic,
    TriggerSchedulerTaskRequest,
    UpdateSchedulerTaskRequest,
)

from . import controller

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


@router.post("/tasks", response_model=SchedulerTaskPublic)
def create_scheduler_task(body: CreateSchedulerTaskRequest) -> SchedulerTaskPublic:
    try:
        return controller.create_task(body)
    except (ValueError, controller.SchedulerTaskConflictError) as exc:
        http_bad_request(exc)


@router.get("/tasks", response_model=list[SchedulerTaskPublic])
def get_scheduler_tasks(enabled: bool | None = None) -> list[SchedulerTaskPublic]:
    return controller.list_tasks(enabled=enabled)


@router.get("/tasks/{task_id}", response_model=SchedulerTaskPublic)
def get_scheduler_task(task_id: str) -> SchedulerTaskPublic:
    try:
        return controller.get_task(task_id)
    except controller.SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None


@router.patch("/tasks/{task_id}", response_model=SchedulerTaskPublic)
def update_scheduler_task(task_id: str, body: UpdateSchedulerTaskRequest) -> SchedulerTaskPublic:
    try:
        return controller.update_task(task_id, body)
    except controller.SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None
    except (ValueError, controller.SchedulerTaskConflictError) as exc:
        http_bad_request(exc)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_scheduler_task(task_id: str) -> None:
    try:
        controller.delete_task(task_id)
    except controller.SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None


@router.post("/tasks/{task_id}/trigger", response_model=SchedulerJobPublic)
def trigger_scheduler_task(task_id: str, body: TriggerSchedulerTaskRequest) -> SchedulerJobPublic:
    try:
        return controller.trigger_task(task_id, body)
    except controller.SchedulerTaskNotFoundError:
        raise HTTPException(status_code=404, detail="任务不存在") from None
    except ValueError as exc:
        http_bad_request(exc)


@router.get("/jobs", response_model=SchedulerJobListResponse)
def get_scheduler_jobs(
    task_id: str | None = None,
    status: str | None = Query(
        default=None,
        description="任务状态，支持逗号分隔多个值，如 queued,running,retrying",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1),
) -> SchedulerJobListResponse:
    return controller.list_jobs(
        task_id=task_id,
        statuses=parse_csv_query(status),
        page=page,
        page_size=page_size,
    )


@router.post("/jobs/{job_id}/cancel", response_model=SchedulerJobPublic)
def cancel_scheduler_job(job_id: str) -> SchedulerJobPublic:
    try:
        return controller.cancel_job(job_id)
    except controller.SchedulerJobNotFoundError:
        raise HTTPException(status_code=404, detail="任务实例不存在") from None


@router.get("/jobs/{job_id}/logs", response_model=list[SchedulerJobLogPublic])
def get_scheduler_job_logs(job_id: str, limit: int | None = 100) -> list[SchedulerJobLogPublic]:
    return controller.list_job_logs(job_id, limit=limit)
