from __future__ import annotations

from app.evaluation_run.schemas import FactorEvaluationRowPublic
from app.evaluation_run.service import execute_and_persist_factor_evaluation_run
from app.factors.registry import FactorItemsRegistry

from .redistry import EvaluationProfilesRegistry


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: str) -> None:
        self.profile_id = profile_id
        super().__init__(profile_id)


class FactorNotFoundError(LookupError):
    def __init__(self, factor_id: str) -> None:
        self.factor_id = factor_id
        super().__init__(factor_id)


def run_factor_evaluation(profile_id: str, factor_id: str) -> FactorEvaluationRowPublic:
    prof = EvaluationProfilesRegistry.get_by_id(profile_id)
    if prof is None:
        raise ProfileNotFoundError(profile_id)
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise FactorNotFoundError(factor_id)
    eval_rec = execute_and_persist_factor_evaluation_run(
        factor_id,
        evaluation_profile=prof,
    )
    err_raw = (eval_rec.error or "").strip()
    err: str | None = err_raw or None
    return FactorEvaluationRowPublic(
        factor_id=factor_id,
        name=rec.name,
        has_evaluation=True,
        evaluated_at=eval_rec.evaluated_at,
        error=err,
        evaluation_profile_id=eval_rec.evaluation_profile_id,
        results=eval_rec.results,
    )
