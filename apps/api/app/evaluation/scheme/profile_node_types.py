"""Profile API: evaluation workflow node types as a single catalog list."""

from __future__ import annotations

from typing import Any

from app.evaluation.metrics.metric_schemas import (
    EvaluationMetricsRegistryFile,
    registry_metric_id_from_workflow_type,
    static_workflow_parameters_for_profile_node,
)
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry
from app.evaluation.scheme.workflow_graph_types import (
    sorted_workflow_node_type_ids,
    workflow_node_definition,
)
from app.shared.node_type_dto import NodeTypeDefinitionPublic, node_spec_to_public


def workflow_node_api_extra(
    node_type: str,
    metrics_reg: EvaluationMetricsRegistryFile,
) -> dict[str, Any]:
    """Build flattened ``extra`` fields for ``/evaluation-profiles/node-types``."""
    nt = (node_type or "").strip()
    static = static_workflow_parameters_for_profile_node(nt)
    if static is not None:
        return {"workflow_parameters": [p.model_dump() for p in static]}
    registry_id = registry_metric_id_from_workflow_type(nt)
    mrec = EvaluationMetricsRegistry.get_by_id(metrics_reg, registry_id) if registry_id else None
    wp = [p.model_dump() for p in mrec.workflow_parameters] if mrec is not None else []
    return {
        "workflow_parameters": wp,
        "metric_id": registry_id,
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
            node_spec_to_public(spec, extra=workflow_node_api_extra(nt, metrics_reg)),
        )
    return out
