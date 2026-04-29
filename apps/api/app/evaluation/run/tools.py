from __future__ import annotations

from typing import Any

from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.run.controller import (
    EvaluationRunNotFoundError,
)
from app.evaluation.run.controller import (
    delete_evaluation_run as delete_evaluation_run_controller,
)
from app.evaluation.run.controller import (
    enqueue_evaluation_run as enqueue_evaluation_run_controller,
)
from app.evaluation.run.controller import (
    get_evaluation_run_detail as get_evaluation_run_detail_controller,
)
from app.evaluation.run.controller import (
    list_evaluation_runs as list_evaluation_runs_controller,
)
from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool


@safe_tool(
    "运行评价任务",
    description="触发一次因子评价运行。\n入参 profile_id 与 factor_id；异步调度执行，行为与 POST /evaluation/run 一致。",
)
def run_evaluation_run(profile_id: str, factor_id: str) -> dict[str, Any]:
    try:
        job = enqueue_evaluation_run_controller(profile_id, factor_id)
    except ProfileNotFoundError:
        raise ValueError(f"评价方案 {profile_id} 不存在") from None
    except FactorNotFoundError:
        raise ValueError(f"因子 {factor_id} 不存在") from None
    return job.model_dump(mode="json")


@safe_tool(
    "获取评价运行列表",
    description="查询评价运行记录列表。\n可按 factor_id 过滤并设置 limit；返回 run 时间、状态、错误信息与 results。",
)
def list_evaluation_runs(
    factor_id: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    rows = list_evaluation_runs_controller(factor_id=factor_id, limit=limit)
    return [row.model_dump(mode="json") for row in rows]


@safe_tool("获取评价运行详情", description="查询评价运行详情。\n入参 run_id；不存在需报错。")
def get_evaluation_run_detail(run_id: str) -> dict[str, Any]:
    try:
        row = get_evaluation_run_detail_controller(run_id)
    except EvaluationRunNotFoundError:
        raise ValueError(f"评价运行记录 {run_id} 不存在") from None
    return row.model_dump(mode="json")


@safe_tool(
    "删除评价运行记录",
    description="删除评价运行记录。\n入参 run_id；成功无返回，不存在需报错。",
)
def delete_evaluation_run(run_id: str) -> None:
    try:
        delete_evaluation_run_controller(run_id)
    except EvaluationRunNotFoundError:
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
