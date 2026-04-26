"""Factor registry, validation, dynamic loading, and Alphalens / profile evaluation."""

from pathlib import Path

from app.chat.agents.skill_store_sync import register_skill_source
from app.startup_jobs import register_startup_job

register_skill_source(
    module="factors",
    skill_name="create_factor",
    file_path=Path(__file__).resolve().parent / "skills" / "create_factor.md",
)


@register_startup_job
def register_factor_chat_tools() -> None:
    from app.factors.tools import (
        create_factor_tool,
        delete_factor_tool,
        get_factor_base_source,
        get_factor_detail,
        get_factor_list,
        get_new_factor_template,
        update_factor_tool,
    )
    from app.tool.models import ToolAuthorization
    from app.tool.registry import ChatToolRegistry

    tool_defs = [
        ("factor.get_new_factor_template", get_new_factor_template, ToolAuthorization.allowed),
        ("factor.get_factor_base_source", get_factor_base_source, ToolAuthorization.allowed),
        ("factor.create_factor", create_factor_tool, ToolAuthorization.allowed),
        ("factor.get_factor_detail", get_factor_detail, ToolAuthorization.allowed),
        ("factor.get_factor_list", get_factor_list, ToolAuthorization.allowed),
        ("factor.update_factor", update_factor_tool, ToolAuthorization.need_authorize),
        ("factor.delete_factor", delete_factor_tool, ToolAuthorization.disabled),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="因子",
            authorization=authorization,
        )
