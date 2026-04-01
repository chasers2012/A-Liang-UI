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
        try:
            source = EvaluationMetricsRegistry.read_source(metric)
            _, _, _, inputs, outputs, _ = parse_workflow_node_source(source)
            input_names = [s.name for s in inputs]
            output_names = [s.name for s in outputs]
        except Exception:
            # Keep the catalog resilient: if a single metric is broken, it should
            # still show up in the list (with empty sockets) so users can fix it.
            input_names = []
            output_names = []

        out.append(
            EvaluationNodeTypePublic(
                type=metric.id,
                label=metric.name,
                description=metric.description,
                category=None,
                inputs=input_names,
                outputs=output_names,
            )
        )
    return out
