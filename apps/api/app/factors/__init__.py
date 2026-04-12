"""Factor registry, validation, dynamic loading, and Alphalens / profile evaluation."""

from app.startup_jobs import register_startup_job


@register_startup_job
def register_factor_chat_tools() -> None:
    from app.factors.tools import FACTOR_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in FACTOR_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
