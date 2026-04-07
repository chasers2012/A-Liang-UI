"""Profile API: evaluation workflow node types as a single catalog list.

Built-in nodes and parsed metrics both expose a unified ``inputs`` list on
:class:`workflow.Node` (wire sockets and value fields / :class:`~workflow.node_types.NodeParam`).
"""

from __future__ import annotations

from workflow.parser import Parser

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
        node = Parser.parse_workflow_node_source(source)
        inputs = [Parser.serialize_socket(s) for s in node.inputs]
        outputs = [Parser.serialize_socket(s) for s in node.outputs]

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
