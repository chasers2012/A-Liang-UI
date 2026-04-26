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
    from app.data_set.tools import (
        create_data_set,
        delete_data_set,
        get_data_set_detail,
        get_data_set_list,
        update_data_set,
    )
    from app.tool.models import ToolAuthorization
    from app.tool.registry import ChatToolRegistry

    tool_defs = [
        ("data_set.create_data_set", create_data_set, ToolAuthorization.allowed),
        ("data_set.get_data_set_detail", get_data_set_detail, ToolAuthorization.allowed),
        ("data_set.get_data_set_list", get_data_set_list, ToolAuthorization.allowed),
        ("data_set.update_data_set", update_data_set, ToolAuthorization.need_authorize),
        ("data_set.delete_data_set", delete_data_set, ToolAuthorization.disabled),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="数据集",
            authorization=authorization,
        )
