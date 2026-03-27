"""Migrate legacy evaluation workflow node types to metric:<id>."""

from __future__ import annotations

from app.evaluation.builtin_metric_registry import metric_node_type
from app.evaluation.profile_schemas import EvaluationWorkflow, WorkflowNode

_LEGACY_TYPE_TO_METRIC_ID: dict[str, str] = {
    "mean_information_coefficient": "builtin.mean_ic",
    "mean_return_spread": "builtin.mean_return_spread",
}

_VIZ_MODES = frozenset({"auto", "bars", "bars_diverging", "table", "json", "scalar"})


def _strip_metric_id_param(params: dict) -> dict:
    return {k: v for k, v in dict(params or {}).items() if k != "metric_id"}


def migrate_evaluation_workflow(workflow: EvaluationWorkflow) -> EvaluationWorkflow:
    new_nodes: list[WorkflowNode] = []
    changed = False
    for n in workflow.nodes:
        t = (n.type or "").strip()
        if t in _LEGACY_TYPE_TO_METRIC_ID:
            mid = _LEGACY_TYPE_TO_METRIC_ID[t]
            new_nodes.append(
                n.model_copy(
                    update={
                        "type": metric_node_type(mid),
                        "params": _strip_metric_id_param(n.params or {}),
                    }
                )
            )
            changed = True
        elif t == "user_metric":
            mid = str((n.params or {}).get("metric_id") or "").strip()
            if not mid:
                new_nodes.append(n)
            else:
                new_nodes.append(
                    n.model_copy(
                        update={
                            "type": metric_node_type(mid),
                            "params": _strip_metric_id_param(n.params or {}),
                        }
                    )
                )
                changed = True
        elif t == "result_visualization":
            params = dict(n.params or {})
            mode = params.pop("mode", "auto")
            mode_s = str(mode).strip() if mode is not None else "auto"
            if mode_s not in _VIZ_MODES:
                mode_s = "auto"
            new_nodes.append(
                n.model_copy(
                    update={
                        "type": f"viz_{mode_s}",
                        "params": params,
                    }
                )
            )
            changed = True
        else:
            new_nodes.append(n)
    if not changed:
        return workflow
    return workflow.model_copy(update={"nodes": new_nodes})
