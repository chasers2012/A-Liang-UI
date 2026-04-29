"""Workspace data set registry (bindings, date range, symbols) for evaluation."""

from __future__ import annotations

from multiprocessing.process import parent_process

from app.data_set.constants import WORKFLOW_PREPROCESSING_DOMAIN
from app.data_set.tools import TOOLS
from app.startup_jobs import register_startup_job


@register_startup_job
def _ensure_preprocessors_domain_node_visibility() -> None:
    if parent_process() is not None:
        return

    from app.visibility.controller import ensure_domain_node_visibility_config

    ensure_domain_node_visibility_config(WORKFLOW_PREPROCESSING_DOMAIN)


@register_startup_job
def register_data_set_chat_tools() -> None:
    import app.tool.controller as tool_controller

    tool_controller.register_tools(
        TOOLS,
        category="数据集",
    )
