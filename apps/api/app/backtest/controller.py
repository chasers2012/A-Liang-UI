from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.data_set.controller import get_data_set, get_data_set_detail
from app.scheduler.controller import enqueue_oneoff_job
from app.scheduler.handlers import register_task_handler
from app.strategy.registry import StrategyRegistry

from .models import BacktestRunRow
from .registry import BacktestRunsStore
from .result_manager import BacktestResultManager
from .schemas import BacktestRunDetail, BacktestRunSummary, RunBacktestRequest


class BacktestRunNotFoundError(ValueError):
    def __init__(self, run_id: str) -> None:
        super().__init__(f"backtest run 不存在: {run_id}")
        self.run_id = run_id


def _to_summary(row: BacktestRunRow) -> BacktestRunSummary:
    strategy = StrategyRegistry.get_by_id(row.strategy_id)
    data_set = get_data_set_detail(row.data_set_id)
    return BacktestRunSummary(
        id=row.id,
        strategy_id=row.strategy_id,
        strategy_name=strategy.name if strategy is not None else None,
        data_set_id=row.data_set_id,
        data_set_name=data_set.name if data_set is not None else None,
        status=row.status,  # type: ignore[arg-type]
        queued_at=row.queued_at,
        start_at=row.start_at,
        end_at=row.end_at,
        error=row.error,
    )


def _to_detail(row: BacktestRunRow) -> BacktestRunDetail:
    strategy = StrategyRegistry.get_by_id(row.strategy_id)
    data_set = get_data_set_detail(row.data_set_id)
    return BacktestRunDetail(
        id=row.id,
        strategy_id=row.strategy_id,
        strategy_name=strategy.name if strategy is not None else None,
        data_set_id=row.data_set_id,
        data_set_name=data_set.name if data_set is not None else None,
        status=row.status,  # type: ignore[arg-type]
        queued_at=row.queued_at,
        start_at=row.start_at,
        end_at=row.end_at,
        error=row.error,
        results=row.results_path,
    )


def enqueue_backtest_run(body: RunBacktestRequest) -> BacktestRunSummary:
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
        params=body.params,
    )
    created_row = BacktestRunsStore.append(row)
    enqueue_oneoff_job(
        task_type="backtest.run",
        trigger_type="manual",
        payload={"run_id": created_row.id},
        max_retries=0,
        timeout_seconds=3600,
        dedupe_key=f"backtest-run:{created_row.id}",
    )
    return _to_summary(created_row)


def list_backtest_runs(
    *,
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[BacktestRunSummary]:
    return [
        _to_summary(r)
        for r in BacktestRunsStore.list_items(strategy_id=strategy_id, status=status, limit=limit)
    ]


def get_backtest_run(run_id: str) -> BacktestRunDetail:
    results = BacktestResultManager.instance()
    row = BacktestRunsStore.get_item(run_id)
    if row is None:
        raise BacktestRunNotFoundError(run_id)

    run = _to_detail(row)
    results_path = run.results
    if not results_path:
        return run

    portfolio = results.read_portfolio_results(results_path)
    if portfolio is not None:
        return run.model_copy(update={"results": portfolio})
    return run


def get_backtest_node_output(run_id: str, node_id: str) -> dict[str, object]:
    return get_backtest_node_output_page(run_id, node_id, file_name=None, page=1, page_size=100)


def get_backtest_node_output_page(
    run_id: str,
    node_id: str,
    *,
    file_name: str | None,
    page: int,
    page_size: int,
) -> dict[str, object]:
    results = BacktestResultManager.instance()
    row = BacktestRunsStore.get_item(run_id)
    if row is None:
        raise BacktestRunNotFoundError(run_id)
    if page < 1:
        raise ValueError("page 必须 >= 1")
    if page_size < 1:
        raise ValueError("page_size 必须 >= 1")
    if page_size > 1000:
        raise ValueError("page_size 不能超过 1000")
    if not row.results_path:
        return {"run_id": run_id, "node_id": node_id, "files": []}

    return results.get_node_output_page(
        run_id=run_id,
        results_path=row.results_path,
        node_id=node_id,
        file_name=file_name,
        page=page,
        page_size=page_size,
    )


def delete_backtest_run(run_id: str) -> None:
    if not BacktestRunsStore.delete_by_id(run_id):
        raise BacktestRunNotFoundError(run_id)


def _backtest_run_handler(payload: dict[str, object]) -> dict[str, object]:
    from .engine.runner import run_backtest_and_persist

    run_id = str(payload.get("run_id", "")).strip()
    if not run_id:
        raise ValueError("backtest.run 任务需要 run_id")
    run_backtest_and_persist(run_id)
    return {"run_id": run_id, "status": "done"}


register_task_handler("backtest.run", _backtest_run_handler)
