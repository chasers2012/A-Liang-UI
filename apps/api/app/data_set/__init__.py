"""Workspace data set registry (bindings, date range, symbols) for evaluation."""

from __future__ import annotations

from multiprocessing.process import parent_process

from app.data_set.constants import WORKFLOW_PREPROCESSING_DOMAIN
from app.startup_jobs import register_startup_job


@register_startup_job
def _ensure_preprocessors_domain_node_visibility() -> None:
    if parent_process() is not None:
        return

    from app.visibility.controller import ensure_domain_node_visibility_config

    ensure_domain_node_visibility_config(WORKFLOW_PREPROCESSING_DOMAIN)


@register_startup_job
def register_data_set_chat_tools() -> None:
    from app.data_set.tools import DATA_SET_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in DATA_SET_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool, category="data_sets")
