"""Evaluation metric registry: CRUD schemas and persistence.

Workflow/runtime integration code lives under :mod:`app.evaluation.metric_workflow`.
"""

from __future__ import annotations

from functools import lru_cache

from app.evaluation.metrics.seed_internal import seed_internal_evaluation_metric_package
from app.startup_jobs import register_startup_job


@register_startup_job
def _register_evaluation_workflow_node_segment() -> None:
    seed_internal_evaluation_metric_package()

    # Register a stable resolver: workflow JSON stores evaluation metric ids
    # (UUID-like) as `node.type`. Resolve them by consulting the
    # EvaluationMetricsRegistry for the actual python source, so the workflow
    # lib doesn't need to assume any on-disk directory layout.
    from workflow import Node, WorkflowNodeLoader
    from workflow.parse import load_workflow_node_class_from_source

    from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry

    @lru_cache(maxsize=256)
    def _metric_id_to_node_cls(type_key: str) -> type[Node] | None:
        rec = EvaluationMetricsRegistry.get_item(type_key)
        if rec is None:
            return None
        src = EvaluationMetricsRegistry.read_source(rec)
        return load_workflow_node_class_from_source(src)  # type: ignore[return-value]

    def _resolve_type(type_key: str) -> type[Node] | None:
        # Avoid interfering with module.qualname style types.
        if "." in type_key:
            return None
        try:
            return _metric_id_to_node_cls(type_key)
        except Exception:
            return None

    WorkflowNodeLoader.instance().register_resolver(_resolve_type, prepend=True)
