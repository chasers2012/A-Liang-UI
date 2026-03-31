"""Evaluation metric registry: CRUD schemas and persistence.

Workflow/runtime integration code lives under :mod:`app.evaluation.metric_workflow`.
"""

from __future__ import annotations

from app.evaluation.metrics.seed_internal import seed_internal_evaluation_metric_package
from app.startup_jobs import register_startup_job


@register_startup_job
def _register_evaluation_workflow_node_segment() -> None:
    seed_internal_evaluation_metric_package()
