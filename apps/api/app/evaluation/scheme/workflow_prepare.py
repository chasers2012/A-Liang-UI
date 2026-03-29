"""Merge profile-level Alphalens defaults into ``prepare_alphalens`` node params."""

from __future__ import annotations

from workflow import WorkflowNode

from .profile_schemas import (
    EvaluationProfilePrepare,
    EvaluationWorkflow,
)


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


def merge_profile_prepare_into_workflow(
    workflow: EvaluationWorkflow,
    *,
    profile_prepare: EvaluationProfilePrepare | None = None,
) -> EvaluationWorkflow:
    """Fill missing ``prepare_alphalens`` params from profile-level prepare settings."""
    stamped, changed = _stamp_prepare_alphalens_from_profile(list(workflow.nodes), profile_prepare)
    if not changed:
        return workflow
    return workflow.model_copy(update={"nodes": stamped})
