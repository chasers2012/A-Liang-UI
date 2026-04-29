"""Knowledge module."""

from app.startup_jobs import register_startup_job

from .config import register_knowledge_settings_module

register_knowledge_settings_module()


@register_startup_job
def register_knowledge_chat_tools() -> None:
    from .tools import register_knowledge_tools

    register_knowledge_tools()
