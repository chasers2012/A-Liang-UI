"""Profile API: evaluation workflow node types as a single catalog list.

Built-in nodes and parsed metrics both expose a unified ``inputs`` list on
:class:`workflow.Node` (wire sockets and value fields / :class:`~workflow.node_types.NodeParam`).
"""

from __future__ import annotations

from workflow.parse import parse_workflow_node_source

from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry
from app.evaluation.profile.internal_nodes import get_internal_nodes

from .profile_schemas import EvaluationNodeTypePublic


def list_evaluation_profile_node_types_public() -> list[EvaluationNodeTypePublic]:
    """Ordered node types from the evaluation catalog with API extras (unified iteration)."""
    out: list[EvaluationNodeTypePublic] = []

    internal_nodes = get_internal_nodes()
    out.extend(internal_nodes)

    # metrics nodes
    for metric in EvaluationMetricsRegistry.list_items():
        source = EvaluationMetricsRegistry.read_source(metric)
        _, _, inputs, outputs = parse_workflow_node_source(source)
        inputs = [s.serialize() for s in inputs]
        outputs = [s.serialize() for s in outputs]

        out.append(
            EvaluationNodeTypePublic(
                type=metric.id,
                label=metric.name,
                description=metric.description,
                category=None,
                inputs=inputs,
                outputs=outputs,
            )
        )
    return out
