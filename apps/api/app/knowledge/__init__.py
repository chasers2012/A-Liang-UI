"""Knowledge module."""

from app.startup_jobs import register_startup_job


@register_startup_job
def register_knowledge_chat_tools() -> None:
    from app.knowledge.tools import register_knowledge_tools

    register_knowledge_tools()
