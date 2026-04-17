from __future__ import annotations

from app.backtest.controller import enqueue_backtest_run
from app.backtest.schemas import RunBacktestRequest
from app.scheduler.controller import list_jobs


def test_backtest_enqueue_uses_scheduler(client, monkeypatch):
    monkeypatch.setattr("app.backtest.controller.StrategyRegistry.get_by_id", lambda _sid: object())
    monkeypatch.setattr("app.backtest.controller.get_data_set", lambda _did: object())

    run = enqueue_backtest_run(
        RunBacktestRequest(
            strategy_id="s1",
            data_set_id="d1",
            initial_cash=10000,
            fees=0.001,
            slippage=0.001,
            signal_lag=1,
            execution_price="close",
        )
    )

    jobs = list_jobs(limit=20)
    job = next(j for j in jobs if j.payload.get("run_id") == run.id)
    assert job.task_id is None
    assert job.task_type == "backtest.run"
    assert job.status == "queued"
