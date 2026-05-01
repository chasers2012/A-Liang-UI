from app.chat.agents.skills import register_chat_agent_skills
from app.startup_jobs import register_startup_job

from .config import register_llm_settings_module
from .tools import TOOLS

register_llm_settings_module()
register_chat_agent_skills()


@register_startup_job
def register_chat_tools() -> None:
    import app.tool.controller as tool_controller

    tool_controller.register_tools(
        TOOLS,
        category="对话",
    )
