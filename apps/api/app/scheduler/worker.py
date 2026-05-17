from __future__ import annotations

import logging
import os
import socket
import threading
import time
from collections.abc import Callable
from uuid import uuid4

from app.scheduler.exceptions import JobCancelledError
from app.scheduler.handlers import run_task_handler
from app.scheduler.schemas import scheduler_job_task_id, scheduler_job_task_type
from app.startup_jobs import register_startup_job

from . import controller, execution

logger = logging.getLogger(__name__)
_WORKER_THREAD: threading.Thread | None = None


def _default_worker_id() -> str:
    return f"{socket.gethostname()}-{os.getpid()}-{uuid4().hex[:8]}"


def run_worker_loop(
    *,
    worker_id: str | None = None,
    poll_seconds: float = 1.0,
    stop_when: Callable[[], bool] | None = None,
) -> None:
    if poll_seconds <= 0:
        raise ValueError("poll_seconds 必须大于 0")
    effective_worker_id = worker_id or _default_worker_id()
    logger.info("scheduler worker started: %s", effective_worker_id)

    while True:
        if stop_when is not None and stop_when():
            logger.info("scheduler worker stopped by stop_when callback")
            return

        job = controller.claim_next_job(effective_worker_id)
        if job is None:
            time.sleep(poll_seconds)
            continue

        try:
            effective_payload: dict = dict(job.payload or {})
            effective_payload["_scheduler"] = {
                "job_id": job.id,
                "task_id": scheduler_job_task_id(job),
            }
            task_type = scheduler_job_task_type(job)
            payload = effective_payload
            result = execution.run_job(
                job.id,
                task_type,
                payload,
                lambda tt=task_type, pl=payload: run_task_handler(tt, pl),
            )
            final_job = controller.mark_job_succeeded(job.id, result)
            if final_job.status == "cancelled":
                logger.info("job %s finished after cancel; result discarded", job.id)
            else:
                logger.info("job %s succeeded", job.id)
        except JobCancelledError:
            logger.info("job %s cancelled during execution", job.id)
        except Exception as exc:
            final_job = controller.mark_job_failed_or_retrying(job.id, str(exc))
            if final_job.status == "cancelled":
                logger.info("job %s failed after cancel; retry suppressed", job.id)
            else:
                logger.exception("job %s failed: %s", job.id, exc)


def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    poll_seconds = float(os.getenv("SCHEDULER_WORKER_POLL_SECONDS", "1"))
    run_worker_loop(poll_seconds=poll_seconds)


@register_startup_job
def recover_scheduler_jobs_after_restart() -> None:
    recovered = controller.recover_incomplete_jobs_on_startup()
    if recovered > 0:
        logger.info("scheduler recovered %s unfinished jobs after restart", recovered)


@register_startup_job
def start_scheduler_worker() -> None:
    global _WORKER_THREAD

    if os.getenv("PYTEST_CURRENT_TEST"):
        return

    enabled = os.getenv("SCHEDULER_EMBEDDED_WORKER_ENABLED", "1").lower() not in {
        "0",
        "false",
        "no",
    }
    if not enabled:
        logger.info("scheduler embedded worker disabled by env")
        return

    if _WORKER_THREAD is not None and _WORKER_THREAD.is_alive():
        return

    poll_seconds = float(os.getenv("SCHEDULER_WORKER_POLL_SECONDS", "1"))
    t = threading.Thread(
        target=run_worker_loop,
        kwargs={"poll_seconds": poll_seconds},
        name="scheduler-worker",
        daemon=True,
    )
    _WORKER_THREAD = t
    t.start()


if __name__ == "__main__":
    main()
