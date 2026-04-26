"""Workspace datasource registry (SQL/CSV), URL building, column introspection, connectivity checks."""

from app.startup_jobs import register_startup_job


@register_startup_job
def register_datasource_chat_tools() -> None:
    from app.datasource.tools import (
        create_datasource,
        delete_datasource,
        get_datasource_detail,
        get_datasource_list,
        test_datasource_connection,
        update_datasource,
    )
    from app.tool.models import ToolAuthorization
    from app.tool.registry import ChatToolRegistry

    tool_defs = [
        ("datasource.create_datasource", create_datasource, ToolAuthorization.allowed),
        ("datasource.get_datasource_detail", get_datasource_detail, ToolAuthorization.allowed),
        ("datasource.get_datasource_list", get_datasource_list, ToolAuthorization.allowed),
        ("datasource.update_datasource", update_datasource, ToolAuthorization.need_authorize),
        ("datasource.delete_datasource", delete_datasource, ToolAuthorization.disabled),
        (
            "datasource.test_datasource_connection",
            test_datasource_connection,
            ToolAuthorization.allowed,
        ),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="数据源",
            authorization=authorization,
        )
