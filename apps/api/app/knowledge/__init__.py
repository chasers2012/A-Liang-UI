"""Knowledge module."""

from app.startup_jobs import register_startup_job

from .config import register_knowledge_settings_module
from .tools import TOOLS

register_knowledge_settings_module()


@register_startup_job
def register_knowledge_chat_tools() -> None:
    import app.tool.controller as tool_controller

    tool_controller.register_tools(
        TOOLS,
        category="知识库",
    )
