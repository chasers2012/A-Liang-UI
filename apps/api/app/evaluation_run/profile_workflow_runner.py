"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import traceback
from typing import Any

from workflow import WorkflowExecutor

from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord
from app.factors.registry import FactorItemsRegistry
from app.factors.schemas import utc_now_iso

from .schemas import FactorEvaluationRecord


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
) -> FactorEvaluationRecord:

    factor = FactorItemsRegistry.get_factor(factor_id)

    exec_ctx: dict[str, Any] = {"factor": factor}

    executor = WorkflowExecutor()

    try:
        node_results = executor.execute(profile.workflow, context=exec_ctx)
    except ValueError as e:
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            error=str(e),
            evaluation_profile_id=profile.id,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            error=f"{e}\n{tb}",
            evaluation_profile_id=profile.id,
        )

    return FactorEvaluationRecord(
        evaluated_at=utc_now_iso(), evaluation_profile_id=profile.id, result=node_results
    )
