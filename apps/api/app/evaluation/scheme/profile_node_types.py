"""Profile API: evaluation workflow node types as a single catalog list.

Built-in node ``workflow_parameters`` come from :class:`workflow.Node.parameters`
when non-empty; otherwise from the metrics registry (user metrics and built-ins).
"""

from __future__ import annotations

from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry

from .profile_schemas import EvaluationNodeTypePublic


def list_evaluation_profile_node_types_public() -> list[EvaluationNodeTypePublic]:
    """Ordered node types from the evaluation catalog with API extras (unified iteration)."""
    out: list[EvaluationNodeTypePublic] = []
    # metrics nodes
    for metric in EvaluationMetricsRegistry.list_items():
        out.append(
            EvaluationNodeTypePublic(
                type=metric.id,
                label=metric.name,
                description=metric.description,
                category=None,
                inputs=[],
                outputs=[],
            )
        )
    return out
