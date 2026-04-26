from __future__ import annotations

from typing import Any

from app.backtest.controller import (
    BacktestRunNotFoundError,
)
from app.backtest.controller import (
    delete_backtest_run as delete_backtest_run_controller,
)
from app.backtest.controller import (
    enqueue_backtest_run as enqueue_backtest_run_controller,
)
from app.backtest.controller import (
    get_backtest_node_output as get_backtest_node_output_controller,
)
from app.backtest.controller import (
    get_backtest_run as get_backtest_run_controller,
)
from app.backtest.controller import (
    list_backtest_runs as list_backtest_runs_controller,
)
from app.backtest.schemas import RunBacktestRequest
from app.tool.safe_tool import safe_tool


@safe_tool(
    "运行回测",
    description="创建并提交一次回测任务。\n入参 body 为 RunBacktestRequest；用于异步调度回测并返回任务详情。",
)
def run_backtest(body: RunBacktestRequest) -> dict[str, Any]:
    try:
        run = enqueue_backtest_run_controller(body)
    except ValueError as e:
        raise ValueError(str(e)) from e
    return run.model_dump(mode="json")


@safe_tool(
    "获取回测任务列表",
    description="查询回测任务列表。\n可按 strategy_id/status 过滤，并可设置 limit 控制返回数量。",
)
def get_backtest_runs(
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    runs = list_backtest_runs_controller(strategy_id=strategy_id, status=status, limit=limit)
    return [r.model_dump(mode="json") for r in runs]


@safe_tool(
    "获取回测任务详情", description="查询回测任务详情。\n入参 run_id；不存在需返回明确错误。"
)
def get_backtest_run_detail(run_id: str) -> dict[str, Any]:
    try:
        run = get_backtest_run_controller(run_id)
    except BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    return run.model_dump(mode="json")


@safe_tool(
    "删除回测任务",
    description="删除指定回测任务。\n入参 run_id；成功返回 {run_id, deleted:true}。",
)
def delete_backtest_run(run_id: str) -> dict[str, Any]:
    try:
        # Keep a detail snapshot to return a useful response.
        _ = get_backtest_run_controller(run_id)
        delete_backtest_run_controller(run_id)
    except BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    return {"run_id": run_id, "deleted": True}


@safe_tool(
    "获取回测净值曲线",
    description="获取回测净值曲线。\n入参 run_id；返回 equity_curve 序列。",
)
def get_backtest_equity(run_id: str) -> dict[str, Any]:
    try:
        run = get_backtest_run_controller(run_id)
    except BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    payload = (run.results or {}).get("equity_curve") if isinstance(run.results, dict) else None
    return {"run_id": run_id, "equity_curve": list(payload or [])}


@safe_tool("获取回测成交明细", description="获取回测成交明细。\n入参 run_id；返回 trades 序列。")
def get_backtest_trades(run_id: str) -> dict[str, Any]:
    try:
        run = get_backtest_run_controller(run_id)
    except BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    payload = (run.results or {}).get("trades") if isinstance(run.results, dict) else None
    return {"run_id": run_id, "trades": list(payload or [])}


@safe_tool(
    "获取回测节点输出",
    description="获取回测节点输出内容。\n入参 run_id 与 node_id；读取该节点在本次回测中的已保存输出文件。",
)
def get_backtest_node_output(run_id: str, node_id: str) -> dict[str, Any]:
    try:
        return get_backtest_node_output_controller(run_id, node_id)
    except BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e


BACKTEST_CHAT_TOOLS = [
    run_backtest,
    get_backtest_runs,
    get_backtest_run_detail,
    delete_backtest_run,
    get_backtest_equity,
    get_backtest_trades,
    get_backtest_node_output,
]
