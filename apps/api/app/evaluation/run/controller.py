from __future__ import annotations

from app.evaluation.profile.controller import FactorNotFoundError, ProfileNotFoundError
from app.evaluation.profile.schemas import EvaluationProfileRecord
from app.factors.registry import FactorItemsRegistry

from .profile_workflow_runner import run_evaluation_profile_workflow
from .redistry import upsert_evaluation_for_factor
from .schemas import FactorEvaluationRecord, FactorEvaluationRowPublic


def execute_and_persist_factor_evaluation_run(
    factor_id: str,
    evaluation_profile: EvaluationProfileRecord,
) -> FactorEvaluationRecord:
    """Execute one factor evaluation run and persist the latest result (evaluations.json)."""
    eval_rec = run_evaluation_profile_workflow(
        factor_id,
        evaluation_profile,
    )
    upsert_evaluation_for_factor(factor_id, eval_rec)
    return eval_rec


def run_factor_evaluation(profile_id: str, factor_id: str) -> FactorEvaluationRowPublic:
    from app.evaluation.profile.redistry import EvaluationProfilesRegistry

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
