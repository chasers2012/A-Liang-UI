from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

import app.data_sync.handler  # noqa: F401 — register datasource.sync scheduler handler
from app.http_errors import http_bad_request
from app.scheduler.controller import SchedulerTaskConflictError

from . import controller
from .schemas import (
    CreateDataSyncTaskRequest,
    DataSyncJobListResponse,
    DataSyncJobLogPublic,
    DataSyncJobPublic,
    DataSyncTaskPublic,
    TriggerDataSyncTaskRequest,
    UpdateDataSyncTaskRequest,
)

router = APIRouter(prefix="/data-sync", tags=["data-sync"])


@router.get("/tasks", response_model=list[DataSyncTaskPublic])
def list_data_sync_tasks(enabled: bool | None = None) -> list[DataSyncTaskPublic]:
    return controller.list_tasks(enabled=enabled)


@router.post("/tasks", response_model=DataSyncTaskPublic)
def create_data_sync_task(body: CreateDataSyncTaskRequest) -> DataSyncTaskPublic:
    try:
        return controller.create_task(body)
    except (ValueError, SchedulerTaskConflictError) as exc:
        http_bad_request(exc)


@router.get("/tasks/{task_id}", response_model=DataSyncTaskPublic)
def get_data_sync_task(task_id: str) -> DataSyncTaskPublic:
    try:
        return controller.get_task(task_id)
    except controller.DataSyncTaskNotFoundError:
        raise HTTPException(status_code=404, detail="数据同步任务不存在") from None


@router.patch("/tasks/{task_id}", response_model=DataSyncTaskPublic)
def update_data_sync_task(task_id: str, body: UpdateDataSyncTaskRequest) -> DataSyncTaskPublic:
    try:
        return controller.update_task(task_id, body)
    except controller.DataSyncTaskNotFoundError:
        raise HTTPException(status_code=404, detail="数据同步任务不存在") from None
    except (ValueError, SchedulerTaskConflictError) as exc:
        http_bad_request(exc)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_data_sync_task(task_id: str) -> None:
    try:
        controller.delete_task(task_id)
    except controller.DataSyncTaskNotFoundError:
        raise HTTPException(status_code=404, detail="数据同步任务不存在") from None


@router.post("/tasks/{task_id}/trigger", response_model=DataSyncJobPublic)
def trigger_data_sync_task(task_id: str, body: TriggerDataSyncTaskRequest) -> DataSyncJobPublic:
    try:
        return controller.trigger_task(task_id, body)
    except controller.DataSyncTaskNotFoundError:
        raise HTTPException(status_code=404, detail="数据同步任务不存在") from None
    except ValueError as exc:
        http_bad_request(exc)


@router.get("/jobs", response_model=DataSyncJobListResponse)
def list_data_sync_jobs(
    task_id: str = Query(..., description="数据同步任务 ID"),
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1),
) -> DataSyncJobListResponse:
    return controller.list_jobs(task_id=task_id, status=status, page=page, page_size=page_size)


@router.post("/jobs/{job_id}/cancel", response_model=DataSyncJobPublic)
def cancel_data_sync_job(job_id: str) -> DataSyncJobPublic:
    try:
        return controller.cancel_job(job_id)
    except controller.DataSyncJobNotFoundError:
        raise HTTPException(status_code=404, detail="数据同步执行记录不存在") from None


@router.get("/jobs/{job_id}/logs", response_model=list[DataSyncJobLogPublic])
def list_data_sync_job_logs(job_id: str, limit: int | None = 100) -> list[DataSyncJobLogPublic]:
    try:
        return controller.list_job_logs(job_id, limit=limit)
    except controller.DataSyncJobNotFoundError:
        raise HTTPException(status_code=404, detail="数据同步执行记录不存在") from None
