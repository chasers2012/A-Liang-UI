from __future__ import annotations

import logging
import os
import threading
import time

from sqlalchemy import and_, or_
from sqlmodel import select

from app.persistence.sqlite_db import get_session
from app.scheduler.models import SchedulerTaskRow
from app.scheduler.utils import next_cron_time, utcnow
from app.startup_jobs import register_startup_job

from . import controller

logger = logging.getLogger(__name__)
_DISPATCHER_THREAD: threading.Thread | None = None


def _list_due_cron_tasks() -> list[SchedulerTaskRow]:
    now = utcnow()
    with get_session() as session:
        stmt = (
            select(SchedulerTaskRow)
            .where(
                and_(
                    SchedulerTaskRow.enabled.is_(True),
                    SchedulerTaskRow.cron_expr.is_not(None),
                    or_(
                        SchedulerTaskRow.next_run_at.is_(None), SchedulerTaskRow.next_run_at <= now
                    ),
                )
            )
            .order_by(SchedulerTaskRow.updated_at.asc())
        )
        return list(session.exec(stmt).all())


def dispatch_due_cron_tasks() -> int:
    dispatched = 0
    now = utcnow()
    for task in _list_due_cron_tasks():
        if not task.cron_expr:
            continue
        scheduled_at = task.next_run_at or now
        dedupe_key = f"cron:{task.id}:{scheduled_at.isoformat()}"
        controller.enqueue_job(task.id, trigger_type="cron", dedupe_key=dedupe_key)
        controller.set_task_next_run(task.id, next_cron_time(task.cron_expr, base_time=now))
        dispatched += 1
    return dispatched


def run_dispatcher_loop(*, poll_seconds: float = 30.0) -> None:
    logger.info("scheduler cron dispatcher started")
    while True:
        try:
            dispatched = dispatch_due_cron_tasks()
            if dispatched > 0:
                logger.info("scheduler cron dispatched %s jobs", dispatched)
        except Exception:
            logger.exception("scheduler cron dispatcher tick failed")
        time.sleep(poll_seconds)


@register_startup_job
def start_cron_dispatcher() -> None:
    global _DISPATCHER_THREAD
    enabled = os.getenv("SCHEDULER_CRON_DISPATCHER_ENABLED", "1").lower() not in {
        "0",
        "false",
        "no",
    }
    if not enabled:
        logger.info("scheduler cron dispatcher disabled by env")
        return
    if _DISPATCHER_THREAD is not None and _DISPATCHER_THREAD.is_alive():
        return
    poll_seconds = float(os.getenv("SCHEDULER_CRON_POLL_SECONDS", "30"))
    t = threading.Thread(
        target=run_dispatcher_loop,
        kwargs={"poll_seconds": poll_seconds},
        daemon=True,
        name="scheduler-cron-dispatcher",
    )
    _DISPATCHER_THREAD = t
    t.start()
