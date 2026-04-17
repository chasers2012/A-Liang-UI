from __future__ import annotations

from app.scheduler.cron_dispatcher import start_cron_dispatcher as _start_cron_dispatcher
from app.scheduler.handlers import register_task_handler
from app.scheduler.worker import start_scheduler_worker as _start_scheduler_worker


def _echo_handler(payload: dict[str, object]) -> dict[str, object]:
    return {"ok": True, "echo": payload}


register_task_handler("echo", _echo_handler)


def _backtest_run_handler(payload: dict[str, object]) -> dict[str, object]:
    from app.backtest.engine.runner import run_backtest_and_persist

    run_id = str(payload.get("run_id", "")).strip()
    if not run_id:
        raise ValueError("backtest.run 任务需要 run_id")
    run_backtest_and_persist(run_id)
    return {"run_id": run_id, "status": "done"}


register_task_handler("backtest.run", _backtest_run_handler)

__all__ = ["_start_cron_dispatcher", "_start_scheduler_worker"]
