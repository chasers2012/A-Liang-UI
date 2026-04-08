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
        "对指定因子执行一次评价方案工作流并写入最新评价结果（与 API "
        "POST /evaluation-profiles/{profile_id}/factors/{factor_id}/evaluations/run 一致）。"
        "入参 profile_id 为评价方案 id，factor_id 为因子 id；"
        "返回字典含 id、factor_id、name、has_evaluation、evaluated_at（对应 run.end_at）、error、evaluation_profile_id、results。"
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
        "列出评价运行记录。可按 factor_id 过滤，并可通过 limit 限制返回数量。"
        "返回数组，每项含 id、factor_id、factor_name、start_at、end_at、error、evaluation_profile_id、results。"
    )
)
def list_evaluation_runs(
    factor_id: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    rows = list_evaluation_runs_controller(factor_id=factor_id, limit=limit)
    return [row.model_dump(mode="json") for row in rows]


@tool(
    description=(
        "按评价运行记录 id 查询详情。"
        "返回字段含 id、factor_id、factor_name、start_at、end_at、error、evaluation_profile_id、results。"
    )
)
def get_evaluation_run_detail(run_id: str) -> dict[str, Any]:
    try:
        row = get_evaluation_run_detail_controller(run_id)
    except EvaluationRunNotFoundError:
        raise ValueError(f"评价运行记录 {run_id} 不存在") from None
    return row.model_dump(mode="json")


@tool(description="按评价运行记录 id 删除一条 run；成功无返回。")
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
