"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import traceback
from typing import Any

from workflow import WorkflowExecutor

from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord
from app.evaluation.scheme.workflow_graph_types import get_evaluation_node_catalog
from app.evaluation.scheme.workflow_prepare import merge_profile_prepare_into_workflow
from app.factors.schemas import utc_now_iso

from .runner import build_alphalens_evaluator_for_factor
from .schemas import FactorEvaluationRecord


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
    *,
    data_set_id: str | None,
) -> FactorEvaluationRecord:
    profile = profile.model_copy(
        update={
            "workflow": merge_profile_prepare_into_workflow(
                profile.workflow,
                profile_prepare=profile.prepare,
            ),
        }
    )
    wf = profile.workflow
    err, ev, window, base_quantiles, _ = build_alphalens_evaluator_for_factor(
        factor_id, data_set_id=data_set_id
    )
    if err is not None:
        return err.model_copy(update={"evaluation_profile_id": profile.id})

    assert ev is not None
    metric_results: dict[str, Any] = {}
    ctx: dict[str, Any] = {
        "ev": ev,
        "last_quantiles": base_quantiles,
        "n_stocks": None,
        "metric_results": metric_results,
        "merged_mean_ic": {},
        "merged_spread": {},
    }

    try:
        _ = WorkflowExecutor(get_evaluation_node_catalog().handlers).execute(
            wf,
            context=ctx,
        )
    except ValueError as e:
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            window=window,
            mean_ic={},
            mean_return_spread={},
            error=str(e),
            evaluation_profile_id=profile.id,
        )
    except Exception as e:
        tb = traceback.format_exc()
        return FactorEvaluationRecord(
            evaluated_at=utc_now_iso(),
            window=window,
            mean_ic={},
            mean_return_spread={},
            error=f"{e}\n{tb}",
            evaluation_profile_id=profile.id,
            metric_results=metric_results,
        )

    return FactorEvaluationRecord(
        evaluated_at=utc_now_iso(),
        window=window,
        stock_count=ctx["n_stocks"],
        mean_ic=ctx["merged_mean_ic"],
        mean_return_spread=ctx["merged_spread"],
        error=None,
        evaluation_profile_id=profile.id,
        metric_results=metric_results,
    )
