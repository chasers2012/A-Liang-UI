"""Profile API: evaluation workflow node types as a single catalog list.

Built-in node ``workflow_parameters`` come from :class:`workflow.Node.parameters`
when non-empty; otherwise from the metrics registry (user metrics and built-ins).
"""

from __future__ import annotations

from workflow.parse import parse_workflow_node_source

from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry

from .profile_schemas import EvaluationNodeTypePublic


def list_evaluation_profile_node_types_public() -> list[EvaluationNodeTypePublic]:
    """Ordered node types from the evaluation catalog with API extras (unified iteration)."""
    out: list[EvaluationNodeTypePublic] = []
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
