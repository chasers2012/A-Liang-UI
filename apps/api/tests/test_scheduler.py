from __future__ import annotations

import time

from app.scheduler.controller import get_task, list_jobs, set_task_next_run
from app.scheduler.cron_dispatcher import dispatch_due_cron_tasks
from app.scheduler.handlers import register_task_handler
from app.scheduler.utils import utcnow
from app.scheduler.worker import run_worker_loop


def test_scheduler_task_create_and_manual_trigger(client):
    task_resp = client.post(
        "/scheduler/tasks",
        json={
            "name": "manual-echo",
            "task_type": "echo",
            "cron_expr": None,
            "payload": {"base": 1},
            "enabled": True,
            "max_retries": 1,
            "timeout_seconds": 30,
        },
    )
    assert task_resp.status_code == 200
    task = task_resp.json()

    trigger_resp = client.post(
        f"/scheduler/tasks/{task['id']}/trigger",
        json={"payload": {"x": 2}},
    )
    assert trigger_resp.status_code == 200
    job = trigger_resp.json()
    assert job["status"] == "queued"
    assert job["trigger_type"] == "manual"
    assert job["payload"]["base"] == 1
    assert job["payload"]["x"] == 2


def test_scheduler_worker_consumes_manual_job(client):
    task_resp = client.post(
        "/scheduler/tasks",
        json={
            "name": "worker-echo",
            "task_type": "echo",
            "payload": {"hello": "world"},
            "enabled": True,
            "max_retries": 0,
            "timeout_seconds": 30,
        },
    )
    task_id = task_resp.json()["id"]
    trigger_resp = client.post(f"/scheduler/tasks/{task_id}/trigger", json={})
    job_id = trigger_resp.json()["id"]

    def _stop() -> bool:
        jobs = list_jobs(limit=10)
        return any(job.id == job_id and job.status == "succeeded" for job in jobs)

    run_worker_loop(worker_id="test-worker", poll_seconds=0.01, stop_when=_stop)
    jobs = list_jobs(limit=10)
    done_job = next(j for j in jobs if j.id == job_id)
    assert done_job.status == "succeeded"
    assert done_job.result["ok"] is True


def test_scheduler_cron_dispatcher_enqueues_due_task(client):
    task_resp = client.post(
        "/scheduler/tasks",
        json={
            "name": "cron-echo",
            "task_type": "echo",
            "cron_expr": "*/5 * * * *",
            "payload": {"source": "cron"},
            "enabled": True,
            "max_retries": 1,
            "timeout_seconds": 30,
        },
    )
    task_id = task_resp.json()["id"]

    set_task_next_run(task_id, utcnow())
    count = dispatch_due_cron_tasks()
    assert count >= 1

    jobs = list_jobs(task_id=task_id, limit=10)
    assert len(jobs) >= 1
    assert jobs[0].trigger_type == "cron"
    refreshed = get_task(task_id)
    assert refreshed.next_run_at is not None


def test_scheduler_worker_retries_then_succeeds(client):
    state = {"called": 0}

    def flaky_handler(payload: dict[str, object]) -> dict[str, object]:
        state["called"] += 1
        if state["called"] == 1:
            raise ValueError("boom")
        return {"payload": payload, "ok": True}

    register_task_handler("flaky", flaky_handler)
    task_resp = client.post(
        "/scheduler/tasks",
        json={
            "name": "flaky-task",
            "task_type": "flaky",
            "payload": {"k": "v"},
            "enabled": True,
            "max_retries": 2,
            "timeout_seconds": 30,
        },
    )
    task_id = task_resp.json()["id"]
    trigger_resp = client.post(f"/scheduler/tasks/{task_id}/trigger", json={})
    job_id = trigger_resp.json()["id"]

    run_worker_loop(
        worker_id="retry-worker-1",
        poll_seconds=0.01,
        stop_when=lambda: any(
            j.id == job_id and j.status == "retrying" for j in list_jobs(limit=10)
        ),
    )
    retrying_job = next(j for j in list_jobs(limit=10) if j.id == job_id)
    assert retrying_job.status == "retrying"
    time.sleep(2.1)

    run_worker_loop(
        worker_id="retry-worker-2",
        poll_seconds=0.01,
        stop_when=lambda: any(
            j.id == job_id and j.status == "succeeded" for j in list_jobs(limit=10)
        ),
    )
    done_job = next(j for j in list_jobs(limit=10) if j.id == job_id)
    assert done_job.status == "succeeded"
    assert state["called"] >= 2
