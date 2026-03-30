from __future__ import annotations

import contextlib

from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord

from .evaluations_store import upsert_evaluation_for_factor
from .history_store import append_history_entry, entry_from_latest_evaluation
from .runner import run_evaluation_for_factor
from .schemas import FactorEvaluationRecord


def execute_and_persist_factor_evaluation_run(
    factor_id: str,
    *,
    data_set_id: str | None = None,
    evaluation_profile: EvaluationProfileRecord | None = None,
    with_history: bool = True,
) -> FactorEvaluationRecord:
    """
    Execute one factor evaluation run and persist:
    1) latest result (evaluations.json)
    2) evaluation history entry (evaluation_history.json) - optional
    """

    eval_rec = run_evaluation_for_factor(
        factor_id,
        data_set_id=data_set_id,
        evaluation_profile=evaluation_profile,
    )
    upsert_evaluation_for_factor(factor_id, eval_rec)

    if with_history:
        entry = entry_from_latest_evaluation(eval_rec)
        with contextlib.suppress(ValueError):
            append_history_entry(factor_id, entry)

    return eval_rec
