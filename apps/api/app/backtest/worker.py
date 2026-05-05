from __future__ import annotations

import queue
import threading
from contextlib import suppress
from datetime import datetime, timezone

from app.startup_jobs import register_startup_job

from .engine.runner import run_backtest_and_persist
from .registry import BacktestRunsStore

_QUEUE: queue.Queue[str] = queue.Queue()
_WORKER_THREAD: threading.Thread | None = None


def enqueue_backtest(run_id: str) -> None:
    _QUEUE.put(run_id)


def _execute_backtest(run_id: str) -> None:
    run_backtest_and_persist(run_id)


def _worker_loop() -> None:
    while True:
        run_id = _QUEUE.get()
        try:
            _execute_backtest(run_id)
        except Exception as e:
            # Best-effort: mark run as failed.
            rec = BacktestRunsStore.get_item(run_id)
            if rec is not None:
                rec.status = "failed"  # type: ignore[assignment]
                rec.error = str(e)
                rec.end_at = datetime.now(timezone.utc)
                BacktestRunsStore.save(rec)
        finally:
            with suppress(Exception):
                _QUEUE.task_done()


@register_startup_job
def start_backtest_worker() -> None:
    global _WORKER_THREAD

    if _WORKER_THREAD is not None and _WORKER_THREAD.is_alive():
        return
    t = threading.Thread(target=_worker_loop, name="backtest-worker", daemon=True)
    _WORKER_THREAD = t
    t.start()
