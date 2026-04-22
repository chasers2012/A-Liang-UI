from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.run.controller import (
    EvaluationRunNotFoundError,
    delete_evaluation_run,
    get_evaluation_run_detail,
    list_evaluation_runs,
    run_evaluation_run,
)
from app.evaluation.run.schemas import (
    EvaluationRunDetailPublic,
    EvaluationRunRowPublic,
    RunEvaluationRunRequest,
)
from app.http_errors import http_bad_request

router = APIRouter(prefix="/evaluation/run", tags=["evaluation/run"])


@router.post(
    "/evalation/run",
    response_model=EvaluationRunRowPublic,
)
def post_evaluation_run_for_profile(
    body: RunEvaluationRunRequest,
) -> EvaluationRunRowPublic:
    try:
        return run_evaluation_run(
            body.profile_id,
            body.factor_id,
            data_set_id=body.data_set_id,
        )
    except ProfileNotFoundError:
        raise HTTPException(status_code=404, detail="评价方案不存在") from None
    except FactorNotFoundError:
        raise HTTPException(status_code=404, detail="因子不存在") from None
    except ValueError as e:
        http_bad_request(e)


@router.get("", response_model=list[EvaluationRunDetailPublic])
def get_evaluation_runs(
    factor_id: str | None = None,
    limit: int | None = None,
) -> list[EvaluationRunDetailPublic]:
    try:
        return list_evaluation_runs(factor_id=factor_id, limit=limit)
    except ValueError as e:
        http_bad_request(e)


@router.get("/{run_id}", response_model=EvaluationRunDetailPublic)
def get_evaluation_run(run_id: str) -> EvaluationRunDetailPublic:
    try:
        return get_evaluation_run_detail(run_id)
    except EvaluationRunNotFoundError:
        raise HTTPException(status_code=404, detail="评价运行记录不存在") from None


@router.delete("/{run_id}", status_code=204)
def delete_evaluation_run_by_id_api(run_id: str) -> None:
    try:
        delete_evaluation_run(run_id)
    except EvaluationRunNotFoundError:
        raise HTTPException(status_code=404, detail="评价运行记录不存在") from None
