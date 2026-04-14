from __future__ import annotations

from datetime import datetime, timezone

from app.backtest.registry import BacktestRunsStore
from app.backtest.schemas import BacktestRunPublic, BacktestRunRecord, RunBacktestRequest
from app.backtest.worker import enqueue_backtest
from app.data_set.controller import get_data_set
from app.strategy.registry import StrategyRegistry


class BacktestRunNotFoundError(ValueError):
    def __init__(self, run_id: str) -> None:
        super().__init__(f"backtest run 不存在: {run_id}")
        self.run_id = run_id


def _to_public(rec: BacktestRunRecord) -> BacktestRunPublic:
    return BacktestRunPublic(
        id=rec.id,
        strategy_id=rec.strategy_id,
        data_set_id=rec.data_set_id,
        status=rec.status,
        queued_at=rec.queued_at,
        start_at=rec.start_at,
        end_at=rec.end_at,
        error=rec.error,
        results=rec.results,
    )


def enqueue_backtest_run(body: RunBacktestRequest) -> BacktestRunPublic:
    strategy = StrategyRegistry.get_by_id(body.strategy_id)
    if strategy is None:
        raise ValueError("策略不存在")
    if get_data_set(body.data_set_id) is None:
        raise ValueError("数据集不存在")

    now = datetime.now(timezone.utc)
    rec = BacktestRunRecord(
        strategy_id=body.strategy_id,
        data_set_id=body.data_set_id,
        status="queued",
        queued_at=now,
        params=body.model_dump(mode="json"),
    )
    BacktestRunsStore.append(rec)
    enqueue_backtest(rec.id)
    return _to_public(rec)


def list_backtest_runs(
    *,
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[BacktestRunPublic]:
    return [
        _to_public(r)
        for r in BacktestRunsStore.list_items(strategy_id=strategy_id, status=status, limit=limit)
    ]


def get_backtest_run(run_id: str) -> BacktestRunPublic:
    rec = BacktestRunsStore.get_item(run_id)
    if rec is None:
        raise BacktestRunNotFoundError(run_id)
    return _to_public(rec)


def delete_backtest_run(run_id: str) -> None:
    if not BacktestRunsStore.delete_by_id(run_id):
        raise BacktestRunNotFoundError(run_id)
