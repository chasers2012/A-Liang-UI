"""Generic workflow node registry module."""

from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_workflow_node_chat_tools() -> None:
    from app.nodes.tools import (
        create_workflow_node_tool,
        delete_workflow_node_tool,
        get_new_workflow_node_template,
        get_workflow_node_detail,
        get_workflow_node_list,
        update_workflow_node,
    )
    from app.tool.models import ToolAuthorization
    from app.tool.registry import ChatToolRegistry

    tool_defs = [
        (
            "node.get_new_workflow_node_template",
            get_new_workflow_node_template,
            ToolAuthorization.allowed,
        ),
        ("node.create_workflow_node", create_workflow_node_tool, ToolAuthorization.allowed),
        ("node.get_workflow_node_detail", get_workflow_node_detail, ToolAuthorization.allowed),
        ("node.get_workflow_node_list", get_workflow_node_list, ToolAuthorization.allowed),
        ("node.update_workflow_node", update_workflow_node, ToolAuthorization.need_authorize),
        ("node.delete_workflow_node", delete_workflow_node_tool, ToolAuthorization.disabled),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="节点",
            authorization=authorization,
        )
