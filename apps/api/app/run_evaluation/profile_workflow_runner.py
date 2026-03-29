"""Execute evaluation profile workflow (node graph) for one factor."""

from __future__ import annotations

import traceback
from typing import Any

from workflow import WorkflowExecutor

from app.evaluation.scheme.profile_schemas import EvaluationProfileRecord
from app.evaluation.scheme.workflow_graph_types import get_evaluation_node_catalog
from app.factors.schemas import utc_now_iso

from .runner import build_alphalens_evaluator_for_factor
from .schemas import FactorEvaluationRecord


def run_evaluation_profile_workflow(
    factor_id: str,
    profile: EvaluationProfileRecord,
    *,
    data_set_id: str | None,
) -> FactorEvaluationRecord:
    wf = profile.workflow
    err, ev, window, base_quantiles, _ = build_alphalens_evaluator_for_factor(
        factor_id, data_set_id=data_set_id
    )
    if err is not None:
        return err.model_copy(update={"evaluation_profile_id": profile.id})

    assert ev is not None

    try:
        node_results = WorkflowExecutor(get_evaluation_node_catalog().handlers).execute(
            wf,
            input_sockets={
                "ev": ev,
                "last_quantiles": base_quantiles,
                # n_stocks / merged_* are produced by downstream nodes.
            },
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
            metric_results={},
        )

    metric_results: dict[str, Any] = {}
    merged_mean_ic: dict[str, Any] = {}
    merged_spread: dict[str, Any] = {}
    stock_count: int | None = None

    for nid, node_out in node_results.items():
        # prepare_alphalens
        if "clean_factor" in node_out:
            metric_results[nid] = {"clean_factor": "[DataFrame]"}
        else:
            # Only keep a single primary payload per node (old behavior).
            primary_keys = [k for k in node_out if k not in {"merged_mean_ic", "merged_spread"}]
            if primary_keys:
                pk = primary_keys[0]
                metric_results.setdefault(nid, {})[pk] = node_out[pk]

        if "merged_mean_ic" in node_out:
            merged_mean_ic = dict(node_out.get("merged_mean_ic") or {})
        if "merged_spread" in node_out:
            merged_spread = dict(node_out.get("merged_spread") or {})
        if "n_stocks" in node_out:
            stock_count = node_out.get("n_stocks")

    return FactorEvaluationRecord(
        evaluated_at=utc_now_iso(),
        window=window,
        stock_count=stock_count,
        mean_ic=merged_mean_ic,
        mean_return_spread=merged_spread,
        error=None,
        evaluation_profile_id=profile.id,
        metric_results=metric_results,
    )
