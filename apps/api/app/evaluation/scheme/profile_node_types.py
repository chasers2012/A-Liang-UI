"""Profile API: evaluation workflow node types as a single catalog list.

Built-in node ``workflow_parameters`` come from :class:`workflow.Node.parameters`
when non-empty; otherwise from the metrics registry (user metrics and built-ins).
"""

from __future__ import annotations

from typing import Any

from workflow import Node, NodeParamModel

from app.evaluation.metrics.metric_schemas import (
    EvaluationMetricsRegistryFile,
    registry_metric_id_from_workflow_type,
)
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry
from app.evaluation.scheme.workflow_graph_types import (
    sorted_workflow_node_type_ids,
    workflow_node_definition,
)
from app.shared.node_type_dto import NodeTypeDefinitionPublic, node_spec_to_public


def _workflow_parameters_from_node_spec(spec: Node) -> list[dict[str, Any]]:
    if not spec.parameters:
        return []
    out: list[dict[str, Any]] = []
    for p in spec.parameters:
        validated = NodeParamModel.model_validate(p.to_public_dict())
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

    registry_id = registry_metric_id_from_workflow_type(nt)
    mrec = EvaluationMetricsRegistry.get_by_id(metrics_reg, registry_id) if registry_id else None
    if mrec is None:
        for rec in metrics_reg.items:
            if rec.workflow_type_id == nt:
                mrec = rec
                break

    wp = [p.model_dump() for p in mrec.workflow_parameters] if mrec is not None else []
    metric_id_out = registry_id
    if metric_id_out is None and mrec is not None:
        metric_id_out = mrec.id
    if metric_id_out is None and nt.startswith("builtin_"):
        metric_id_out = nt

    return {
        "workflow_parameters": wp,
        "metric_id": metric_id_out,
        "user_defined": bool(mrec is not None and not mrec.builtin),
    }


def list_evaluation_profile_node_types_public(
    metrics_reg: EvaluationMetricsRegistryFile,
) -> list[NodeTypeDefinitionPublic]:
    """Ordered node types from the evaluation catalog with API extras (unified iteration)."""
    out: list[NodeTypeDefinitionPublic] = []
    for nt in sorted_workflow_node_type_ids():
        spec = workflow_node_definition(nt)
        out.append(
            node_spec_to_public(spec, extra=workflow_node_api_extra(nt, spec, metrics_reg)),
        )
    return out
