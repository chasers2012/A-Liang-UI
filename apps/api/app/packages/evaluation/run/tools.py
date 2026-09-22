from __future__ import annotations

from typing import Any

from app.packages.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.packages.tool.models import ToolAuthorization
from app.packages.tool.safe_tool import safe_tool

from . import controller


@safe_tool("run_evaluation_run", parse_docstring=True)
def run_evaluation_run(profile_id: str, factor_id: str) -> dict[str, Any]:
    """
    触发一次因子评价运行（异步调度）。

    行为与 `POST /evaluation/run` 一致。

    Args:
        profile_id: 评价方案 ID。
        factor_id: 因子 ID。

    Returns:
        异步任务详情（JSON 可序列化）。
    """
    try:
        job = controller.enqueue_evaluation_run(profile_id, factor_id)
    except ProfileNotFoundError:
        raise ValueError(f"评价方案 {profile_id} 不存在") from None
    except FactorNotFoundError:
        raise ValueError(f"因子 {factor_id} 不存在") from None
    return job.model_dump(mode="json")


@safe_tool("list_evaluation_runs", parse_docstring=True)
def list_evaluation_runs(
    factor_id: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """
    查询评价运行记录列表。

    Args:
        factor_id: 可选，按因子 ID 过滤。
        limit: 可选，控制返回数量上限。

    Returns:
        评价运行记录列表（包含 run 时间、状态、错误信息与 results）。
    """
    rows = controller.list_evaluation_runs(factor_id=factor_id, limit=limit)
    return [row.model_dump(mode="json") for row in rows]


@safe_tool("get_evaluation_run_detail", parse_docstring=True)
def get_evaluation_run_detail(run_id: str) -> dict[str, Any]:
    """
    查询评价运行详情。

    Args:
        run_id: 评价运行记录 ID；不存在需报错。

    Returns:
        评价运行详情（JSON 可序列化）。
    """
    try:
        row = controller.get_evaluation_run_detail(run_id)
    except controller.EvaluationRunNotFoundError:
        raise ValueError(f"评价运行记录 {run_id} 不存在") from None
    return row.model_dump(mode="json")


@safe_tool("delete_evaluation_run", parse_docstring=True)
def delete_evaluation_run(run_id: str) -> None:
    """
    删除评价运行记录。

    Args:
        run_id: 评价运行记录 ID；不存在需报错。

    Returns:
        无返回。
    """
    try:
        controller.delete_evaluation_run(run_id)
    except controller.EvaluationRunNotFoundError:
        raise ValueError(f"评价运行记录 {run_id} 不存在") from None


TOOLS = {
    "evaluation_run.run_evaluation_run": (run_evaluation_run, ToolAuthorization.allowed),
    "evaluation_run.list_evaluation_runs": (list_evaluation_runs, ToolAuthorization.allowed),
    "evaluation_run.get_evaluation_run_detail": (
        get_evaluation_run_detail,
        ToolAuthorization.allowed,
    ),
    "evaluation_run.delete_evaluation_run": (delete_evaluation_run, ToolAuthorization.disabled),
}
