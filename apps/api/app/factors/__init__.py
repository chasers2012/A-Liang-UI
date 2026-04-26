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
    from app.factors.tools import FACTOR_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in FACTOR_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool, category="factors")
