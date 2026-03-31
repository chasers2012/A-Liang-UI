"""
Factor evaluation domain.

- ``app.evaluation.metrics``: custom metric definitions, storage, resolution.
- ``app.evaluation.scheme``: profiles, DAG validation, data sets, workflow run.
"""

from __future__ import annotations

from app.startup_jobs import register_startup_job
from app.workflow_nodes import register_workflow_node_package

register_workflow_node_package(
    "evaluation", "evaluation_workflow_nodes", kind="builtin", append=True
)


@register_startup_job
def _register_evaluation_workflow_node_segment() -> None:
    from app.workflow_nodes import WorkflowNodeLoader

    WorkflowNodeLoader.register_workflow_node_segment("evaluation", append=True)
