from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.http_errors import http_bad_request

from . import controller
from .schemas import (
    BacktestRunDetail,
    BacktestRunFormSpecPublic,
    BacktestRunSummary,
    RunBacktestRequest,
    backtest_run_form_spec_public,
)

router = APIRouter(prefix="/backtests", tags=["backtests"])


@router.post("/run", response_model=BacktestRunSummary)
def run_backtest(body: RunBacktestRequest) -> BacktestRunSummary:
    try:
        return controller.enqueue_backtest_run(body)
    except ValueError as e:
        http_bad_request(e)


@router.get("/run/spec", response_model=BacktestRunFormSpecPublic)
def get_backtest_run_spec() -> BacktestRunFormSpecPublic:
    return backtest_run_form_spec_public()


@router.get("", response_model=list[BacktestRunSummary])
def get_backtest_runs(
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[BacktestRunSummary]:
    return controller.list_backtest_runs(strategy_id=strategy_id, status=status, limit=limit)


@router.get("/{run_id}", response_model=BacktestRunDetail)
def get_backtest_run_api(run_id: str) -> BacktestRunDetail:
    try:
        return controller.get_backtest_run(run_id)
    except controller.BacktestRunNotFoundError:
        raise HTTPException(status_code=404, detail="回测运行记录不存在") from None


@router.get("/{run_id}/nodes/{node_id}/output")
def get_backtest_node_output_api(run_id: str, node_id: str) -> dict[str, object]:
    try:
        return controller.get_backtest_node_output(run_id, node_id)
    except controller.BacktestRunNotFoundError:
        raise HTTPException(status_code=404, detail="回测运行记录不存在") from None


@router.get("/{run_id}/nodes/{node_id}/output/page")
def get_backtest_node_output_page_api(
    run_id: str,
    node_id: str,
    file: str,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, object]:
    try:
        return controller.get_backtest_node_output_page(
            run_id,
            node_id,
            file_name=file,
            page=page,
            page_size=page_size,
        )
    except controller.BacktestRunNotFoundError:
        raise HTTPException(status_code=404, detail="回测运行记录不存在") from None
    except ValueError as e:
        http_bad_request(e)


@router.delete("/{run_id}", status_code=204)
def delete_backtest_run_api(run_id: str) -> None:
    try:
        controller.delete_backtest_run(run_id)
    except controller.BacktestRunNotFoundError:
        raise HTTPException(status_code=404, detail="回测运行记录不存在") from None
