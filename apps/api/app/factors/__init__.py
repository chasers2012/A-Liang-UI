"""Factor registry, validation, dynamic loading, and Alphalens / profile evaluation."""

from app.factors.skills import register_factor_skills
from app.startup_jobs import register_startup_job

register_factor_skills()


@register_startup_job
def register_factor_chat_tools() -> None:
    from app.factors.tools import register_factor_chat_tools as _register_factor_chat_tools

    _register_factor_chat_tools()
