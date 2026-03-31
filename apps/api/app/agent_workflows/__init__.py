from __future__ import annotations

from app.startup_jobs import register_startup_job
from app.workflow_nodes import register_workflow_node_package

register_workflow_node_package("agent", "agent_workflow_nodes", kind="builtin", append=True)


@register_startup_job
def _register_agent_workflow_node_segment() -> None:
    from app.workflow_nodes import WorkflowNodeLoader

    WorkflowNodeLoader.register_workflow_node_segment("agent", append=True)
