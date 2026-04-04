from __future__ import annotations

from app.evaluation.profile.profile_schemas import EvaluationProfileRecord
from app.evaluation_run.profile_workflow_runner import run_evaluation_profile_workflow

from .evaluations_store import upsert_evaluation_for_factor
from .schemas import FactorEvaluationRecord


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
