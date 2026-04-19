from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.backtest.controller import (
    BacktestRunNotFoundError,
    delete_backtest_run,
    enqueue_backtest_run,
    get_backtest_run,
    list_backtest_runs,
)
from app.backtest.schemas import BacktestRunDetail, BacktestRunSummary, RunBacktestRequest
from app.http_errors import http_bad_request

router = APIRouter(prefix="/backtests", tags=["backtests"])


@router.post("/run", response_model=BacktestRunSummary)
def run_backtest(body: RunBacktestRequest) -> BacktestRunSummary:
    try:
        return enqueue_backtest_run(body)
    except ValueError as e:
        http_bad_request(e)


@router.get("", response_model=list[BacktestRunSummary])
def get_backtest_runs(
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[BacktestRunSummary]:
    return list_backtest_runs(strategy_id=strategy_id, status=status, limit=limit)


@router.get("/{run_id}", response_model=BacktestRunDetail)
def get_backtest_run_api(run_id: str) -> BacktestRunDetail:
    try:
        return get_backtest_run(run_id)
    except BacktestRunNotFoundError:
        raise HTTPException(status_code=404, detail="回测运行记录不存在") from None


@router.delete("/{run_id}", status_code=204)
def delete_backtest_run_api(run_id: str) -> None:
    try:
        delete_backtest_run(run_id)
    except BacktestRunNotFoundError:
        raise HTTPException(status_code=404, detail="回测运行记录不存在") from None
