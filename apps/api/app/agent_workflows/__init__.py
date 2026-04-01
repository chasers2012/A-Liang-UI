from __future__ import annotations

from multiprocessing.process import parent_process

from app.startup_jobs import register_startup_job


@register_startup_job
def _register_agent_workflow_node_segment() -> None:
    # Avoid registering workflow node segments in forked/spawned worker processes.
    if parent_process() is not None:
        return
