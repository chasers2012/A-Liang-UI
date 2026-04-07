from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.run.controller import run_factor_evaluation as run_factor_evaluation_controller


@tool(
    description=(
        "对指定因子执行一次评价方案工作流并写入最新评价结果（与 API "
        "POST /evaluation-profiles/{profile_id}/factors/{factor_id}/evaluations/run 一致）。"
        "入参 profile_id 为评价方案 id，factor_id 为因子 id；"
        "返回字典含 factor_id、name、has_evaluation、evaluated_at、error、evaluation_profile_id、results。"
    )
)
def run_factor_evaluation(profile_id: str, factor_id: str) -> dict[str, Any]:
    try:
        row = run_factor_evaluation_controller(profile_id, factor_id)
    except ProfileNotFoundError:
        raise ValueError(f"评价方案 {profile_id} 不存在") from None
    except FactorNotFoundError:
        raise ValueError(f"因子 {factor_id} 不存在") from None
    return row.model_dump()


EVALUATION_RUN_CHAT_TOOLS = [
    run_factor_evaluation,
]
