from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.run.controller import run_factor_evaluation
from app.evaluation.run.schemas import (
    FactorEvaluationRowPublic,
    RunFactorEvaluationRequest,
)
from app.http_errors import http_bad_request

router = APIRouter(prefix="/evaluation-profiles", tags=["evaluation-runs"])


@router.post(
    "/evaluations/run",
    response_model=FactorEvaluationRowPublic,
)
def post_factor_evaluation_run_for_profile(
    body: RunFactorEvaluationRequest,
) -> FactorEvaluationRowPublic:
    try:
        return run_factor_evaluation(body.profile_id, body.factor_id)
    except ProfileNotFoundError:
        raise HTTPException(status_code=404, detail="评价方案不存在") from None
    except FactorNotFoundError:
        raise HTTPException(status_code=404, detail="因子不存在") from None
    except ValueError as e:
        http_bad_request(e)
