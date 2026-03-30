"""Profile API: evaluation workflow node types as a single catalog list.

Built-in node ``workflow_parameters`` come from :class:`workflow.Node.parameters`
when non-empty; otherwise from the metrics registry (user metrics and built-ins).
"""

from __future__ import annotations

from typing import Any

from workflow import Node, NodeParamModel

from app.evaluation.metric_workflow.metric_workflow_helpers import (
    builtin_metric_id_from_workflow_node_fqn,
    registry_metric_id_from_workflow_type,
)
from app.evaluation.metrics.metric_schemas import (
    EvaluationMetricRecord,
    EvaluationMetricsRegistryFile,
)
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry
from app.evaluation.scheme.workflow_graph_types import (
    sorted_workflow_node_type_ids,
    workflow_node_definition,
)


def _workflow_parameters_from_node_spec(spec: Node) -> list[dict[str, Any]]:
    if not spec.parameters:
        return []
    out: list[dict[str, Any]] = []
    for p in spec.parameters:
        validated = NodeParamModel.model_validate(p.serialize())
        out.append(validated.model_dump())
    return out


def workflow_node_api_extra(
    node_type: str,
    spec: Node,
    metrics_reg: EvaluationMetricsRegistryFile,
) -> dict[str, Any]:
    """Build flattened ``extra`` fields for ``/evaluation-profiles/node-types``."""
    nt = (node_type or "").strip()
    spec_wp = _workflow_parameters_from_node_spec(spec)
    if spec_wp:
        return {"workflow_parameters": spec_wp}

    mrec, metric_id_out = _metric_record_and_metric_id(metrics_reg, nt)
    wp = [p.model_dump() for p in mrec.workflow_parameters] if mrec is not None else []
    return {
        "workflow_parameters": wp,
        "metric_id": metric_id_out,
        "user_defined": bool(mrec is not None and not mrec.builtin),
    }


def _metric_record_and_metric_id(
    metrics_reg: EvaluationMetricsRegistryFile,
    workflow_type_id: str,
) -> tuple[EvaluationMetricRecord | None, str | None]:
    """Resolve (metric record, metric_id) for a workflow node type id."""
    registry_id = registry_metric_id_from_workflow_type(workflow_type_id)
    if registry_id is None:
        registry_id = builtin_metric_id_from_workflow_node_fqn(workflow_type_id)
    mrec = EvaluationMetricsRegistry.get_by_id(metrics_reg, registry_id) if registry_id else None
    if mrec is None:
        for rec in metrics_reg.items:
            if rec.workflow_type_id == workflow_type_id:
                mrec = rec
                break

    metric_id_out = registry_id
    if metric_id_out is None and mrec is not None:
        metric_id_out = mrec.id
    return mrec, metric_id_out


def list_evaluation_profile_node_types_public(
    metrics_reg: EvaluationMetricsRegistryFile,
) -> list[dict[str, Any]]:
    """Ordered node types from the evaluation catalog with API extras (unified iteration)."""
    out: list[dict[str, Any]] = []
    for nt in sorted_workflow_node_type_ids():
        spec = workflow_node_definition(nt)
        # Return the node's own serialization directly, then merge API extras into the top-level
        # dict (so frontend can consume workflow_parameters/metric_id/user_defined).
        data = spec.serialize()
        data.update(workflow_node_api_extra(nt, spec, metrics_reg))
        out.append(data)
    return out
