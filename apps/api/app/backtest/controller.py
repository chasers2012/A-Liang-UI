from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.backtest.models import BacktestRunRow
from app.backtest.registry import BacktestRunsStore
from app.backtest.schemas import BacktestRunPublic, RunBacktestRequest
from app.backtest.worker import enqueue_backtest
from app.data_set.controller import get_data_set
from app.strategy.registry import StrategyRegistry


class BacktestRunNotFoundError(ValueError):
    def __init__(self, run_id: str) -> None:
        super().__init__(f"backtest run 不存在: {run_id}")
        self.run_id = run_id


def _to_public(row: BacktestRunRow) -> BacktestRunPublic:
    return BacktestRunPublic(
        id=row.id,
        strategy_id=row.strategy_id,
        data_set_id=row.data_set_id,
        status=row.status,  # type: ignore[arg-type]
        queued_at=row.queued_at,
        start_at=row.start_at,
        end_at=row.end_at,
        error=row.error,
        results=row.results,
    )


def enqueue_backtest_run(body: RunBacktestRequest) -> BacktestRunPublic:
    strategy = StrategyRegistry.get_by_id(body.strategy_id)
    if strategy is None:
        raise ValueError("策略不存在")
    if get_data_set(body.data_set_id) is None:
        raise ValueError("数据集不存在")

    now = datetime.now(timezone.utc)
    row = BacktestRunRow(
        id=uuid4().hex,
        strategy_id=body.strategy_id,
        data_set_id=body.data_set_id,
        status="queued",
        queued_at=now,
        params=body.model_dump(mode="json"),
    )
    created_row = BacktestRunsStore.append(row)
    enqueue_backtest(created_row.id)
    return _to_public(created_row)


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
    row = BacktestRunsStore.get_item(run_id)
    if row is None:
        raise BacktestRunNotFoundError(run_id)
    return _to_public(row)


def delete_backtest_run(run_id: str) -> None:
    if not BacktestRunsStore.delete_by_id(run_id):
        raise BacktestRunNotFoundError(run_id)
