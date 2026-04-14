from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.backtest.controller import (
    BacktestRunNotFoundError,
    delete_backtest_run,
    enqueue_backtest_run,
    get_backtest_run,
    list_backtest_runs,
)
from app.backtest.schemas import (
    BacktestEquityResponse,
    BacktestRunPublic,
    BacktestTradesResponse,
    RunBacktestRequest,
)
from app.http_errors import http_bad_request

router = APIRouter(prefix="/backtests", tags=["backtests"])


@router.post("/run", response_model=BacktestRunPublic)
def run_backtest(body: RunBacktestRequest) -> BacktestRunPublic:
    try:
        return enqueue_backtest_run(body)
    except ValueError as e:
        http_bad_request(e)


@router.get("", response_model=list[BacktestRunPublic])
def get_backtest_runs(
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[BacktestRunPublic]:
    return list_backtest_runs(strategy_id=strategy_id, status=status, limit=limit)


@router.get("/{run_id}", response_model=BacktestRunPublic)
def get_backtest_run_api(run_id: str) -> BacktestRunPublic:
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


@router.get("/{run_id}/equity", response_model=BacktestEquityResponse)
def get_backtest_equity(run_id: str) -> BacktestEquityResponse:
    run = get_backtest_run(run_id)
    payload = (run.results or {}).get("equity_curve") if isinstance(run.results, dict) else None
    return BacktestEquityResponse(run_id=run_id, equity_curve=list(payload or []))


@router.get("/{run_id}/trades", response_model=BacktestTradesResponse)
def get_backtest_trades(run_id: str) -> BacktestTradesResponse:
    run = get_backtest_run(run_id)
    payload = (run.results or {}).get("trades") if isinstance(run.results, dict) else None
    return BacktestTradesResponse(run_id=run_id, trades=list(payload or []))
