from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.run.controller import (
    EvaluationRunNotFoundError,
)
from app.evaluation.run.controller import (
    delete_evaluation_run as delete_evaluation_run_controller,
)
from app.evaluation.run.controller import (
    get_evaluation_run_detail as get_evaluation_run_detail_controller,
)
from app.evaluation.run.controller import (
    list_evaluation_runs as list_evaluation_runs_controller,
)
from app.evaluation.run.controller import (
    run_evaluation_run as run_evaluation_run_controller,
)


@tool(
    description=(
        "执行一次因子评价运行（run）。"
        "入参 profile_id（评价方案 id）与 factor_id（因子 id），"
        "行为与 POST /evalation/run 一致。"
        "返回本次评价结果摘要与 results 负载。"
    )
)
def run_evaluation_run(profile_id: str, factor_id: str) -> dict[str, Any]:
    try:
        row = run_evaluation_run_controller(profile_id, factor_id)
    except ProfileNotFoundError:
        raise ValueError(f"评价方案 {profile_id} 不存在") from None
    except FactorNotFoundError:
        raise ValueError(f"因子 {factor_id} 不存在") from None
    return row.model_dump()


@tool(
    description=(
        "查询评价运行记录列表。"
        "可按 factor_id 过滤，并通过 limit 限制数量。"
        "返回每条 run 的时间、状态错误信息和 results 等字段。"
    )
)
def list_evaluation_runs(
    factor_id: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    rows = list_evaluation_runs_controller(factor_id=factor_id, limit=limit)
    return [row.model_dump(mode="json") for row in rows]


@tool(description=("按 run_id 查询评价运行详情；不存在时报错。"))
def get_evaluation_run_detail(run_id: str) -> dict[str, Any]:
    try:
        row = get_evaluation_run_detail_controller(run_id)
    except EvaluationRunNotFoundError:
        raise ValueError(f"评价运行记录 {run_id} 不存在") from None
    return row.model_dump(mode="json")


@tool(description="按 run_id 删除评价运行记录；不存在时报错，成功无返回。")
def delete_evaluation_run(run_id: str) -> None:
    try:
        delete_evaluation_run_controller(run_id)
    except EvaluationRunNotFoundError:
        raise ValueError(f"评价运行记录 {run_id} 不存在") from None


EVALUATION_RUN_CHAT_TOOLS = [
    run_evaluation_run,
    list_evaluation_runs,
    get_evaluation_run_detail,
    delete_evaluation_run,
]
