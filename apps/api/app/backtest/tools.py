from __future__ import annotations

from typing import Any

from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool

from . import controller
from .schemas import RunBacktestRequest


@safe_tool("run_backtest", parse_docstring=True)
def run_backtest(body: RunBacktestRequest) -> dict[str, Any]:
    """
    创建并提交一次回测任务。

    Args:
        body: 回测请求体（`RunBacktestRequest`），用于异步调度回测。

    Returns:
        回测任务详情（JSON 可序列化）。
    """
    try:
        run = controller.enqueue_backtest_run(body)
    except ValueError as e:
        raise ValueError(str(e)) from e
    return run.model_dump(mode="json")


@safe_tool("get_backtest_runs", parse_docstring=True)
def get_backtest_runs(
    strategy_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """
    查询回测任务列表。

    Args:
        strategy_id: 可选，按策略 ID 过滤。
        status: 可选，按状态过滤。
        limit: 可选，控制返回数量上限。

    Returns:
        回测任务列表（JSON 可序列化）。
    """
    runs = controller.list_backtest_runs(strategy_id=strategy_id, status=status, limit=limit)
    return [r.model_dump(mode="json") for r in runs]


@safe_tool("get_backtest_run_detail", parse_docstring=True)
def get_backtest_run_detail(run_id: str) -> dict[str, Any]:
    """
    查询回测任务详情。

    Args:
        run_id: 回测任务 ID；不存在会抛出明确错误。

    Returns:
        回测任务详情（JSON 可序列化）。
    """
    try:
        run = controller.get_backtest_run(run_id)
    except controller.BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    return run.model_dump(mode="json")


@safe_tool("delete_backtest_run", parse_docstring=True)
def delete_backtest_run(run_id: str) -> dict[str, Any]:
    """
    删除指定回测任务。

    Args:
        run_id: 回测任务 ID。

    Returns:
        删除结果，成功返回 `{run_id, deleted:true}`。
    """
    try:
        # Keep a detail snapshot to return a useful response.
        _ = controller.get_backtest_run(run_id)
        controller.delete_backtest_run(run_id)
    except controller.BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    return {"run_id": run_id, "deleted": True}


@safe_tool("get_backtest_equity", parse_docstring=True)
def get_backtest_equity(run_id: str) -> dict[str, Any]:
    """
    获取回测净值曲线。

    Args:
        run_id: 回测任务 ID。

    Returns:
        `{run_id, equity_curve}`，其中 equity_curve 为序列。
    """
    try:
        run = controller.get_backtest_run(run_id)
    except controller.BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    payload = (run.results or {}).get("equity_curve") if isinstance(run.results, dict) else None
    return {"run_id": run_id, "equity_curve": list(payload or [])}


@safe_tool("get_backtest_trades", parse_docstring=True)
def get_backtest_trades(run_id: str) -> dict[str, Any]:
    """
    获取回测成交明细。

    Args:
        run_id: 回测任务 ID。

    Returns:
        `{run_id, trades}`，其中 trades 为序列。
    """
    try:
        run = controller.get_backtest_run(run_id)
    except controller.BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e
    payload = (run.results or {}).get("trades") if isinstance(run.results, dict) else None
    return {"run_id": run_id, "trades": list(payload or [])}


@safe_tool("get_backtest_node_output", parse_docstring=True)
def get_backtest_node_output(run_id: str, node_id: str) -> dict[str, Any]:
    """
    获取回测节点输出内容。

    Args:
        run_id: 回测任务 ID。
        node_id: 节点 ID（回测保存输出所对应的节点）。

    Returns:
        节点输出内容（由后端返回结构决定）。
    """
    try:
        return controller.get_backtest_node_output(run_id, node_id)
    except controller.BacktestRunNotFoundError as e:
        raise ValueError("回测运行记录不存在") from e


TOOLS = {
    "backtest.run_backtest": (run_backtest, ToolAuthorization.allowed),
    "backtest.get_backtest_runs": (get_backtest_runs, ToolAuthorization.allowed),
    "backtest.get_backtest_run_detail": (get_backtest_run_detail, ToolAuthorization.allowed),
    "backtest.delete_backtest_run": (delete_backtest_run, ToolAuthorization.disabled),
    "backtest.get_backtest_equity": (get_backtest_equity, ToolAuthorization.allowed),
    "backtest.get_backtest_trades": (get_backtest_trades, ToolAuthorization.allowed),
    "backtest.get_backtest_node_output": (get_backtest_node_output, ToolAuthorization.allowed),
}
