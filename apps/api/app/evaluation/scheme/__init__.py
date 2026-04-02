"""Evaluation schemes: profiles, workflow graphs, data sets, and execution."""

from __future__ import annotations

from multiprocessing.process import parent_process

from app.startup_jobs import register_startup_job


@register_startup_job
def _register_evaluation_scheme_workflow_node_segment() -> None:
    # Avoid registering workflow node segments in forked/spawned worker processes.
    if parent_process() is not None:
        return

    from workflow import WorkflowNodeLoader, workflow_node_type_key

    from app.evaluation.scheme.internal_nodes import INTERNAL_NODES

    loader = WorkflowNodeLoader.instance()
    for node_cls in INTERNAL_NODES:
        type_key = getattr(node_cls, "type", "") or workflow_node_type_key(node_cls)
        if isinstance(type_key, str) and type_key.strip():
            loader.register_node(type_key, node_cls)
