"""Migrate legacy evaluation workflow node types to metric:<id>; stamp prepare params."""

from __future__ import annotations

from app.evaluation.builtin_metric_registry import metric_node_type
from app.evaluation.profile_schemas import (
    EvaluationProfilePrepare,
    EvaluationWorkflow,
    WorkflowNode,
)

_LEGACY_TYPE_TO_METRIC_ID: dict[str, str] = {
    "mean_information_coefficient": "builtin.mean_ic",
    "mean_return_spread": "builtin.mean_return_spread",
}

_VIZ_MODES = frozenset({"auto", "bars", "bars_diverging", "table", "json", "scalar"})


def _strip_metric_id_param(params: dict) -> dict:
    return {k: v for k, v in dict(params or {}).items() if k != "metric_id"}


def _stamp_prepare_alphalens_from_profile(
    nodes: list[WorkflowNode],
    profile_prepare: EvaluationProfilePrepare | None,
) -> tuple[list[WorkflowNode], bool]:
    if not profile_prepare:
        return nodes, False
    out: list[WorkflowNode] = []
    changed = False
    for n in nodes:
        if (n.type or "").strip() != "prepare_alphalens":
            out.append(n)
            continue
        p = dict(n.params or {})
        merged = False
        if "forward_return_periods" not in p or p.get("forward_return_periods") in (None, ""):
            p["forward_return_periods"] = ",".join(
                str(x) for x in profile_prepare.forward_return_periods
            )
            merged = True
        if "alphalens_quantiles" not in p and "quantiles" not in p:
            p["alphalens_quantiles"] = (
                "" if profile_prepare.quantiles is None else str(int(profile_prepare.quantiles))
            )
            merged = True
        if "long_short" not in p:
            p["long_short"] = profile_prepare.long_short
            merged = True
        if "max_loss" not in p:
            p["max_loss"] = profile_prepare.max_loss
            merged = True
        if merged:
            changed = True
            out.append(n.model_copy(update={"params": p}))
        else:
            out.append(n)
    return out, changed


def migrate_evaluation_workflow(
    workflow: EvaluationWorkflow,
    *,
    profile_prepare: EvaluationProfilePrepare | None = None,
) -> EvaluationWorkflow:
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

    base = new_nodes if changed else list(workflow.nodes)
    stamped, c2 = _stamp_prepare_alphalens_from_profile(base, profile_prepare)
    if not changed and not c2:
        return workflow
    return workflow.model_copy(update={"nodes": stamped})
