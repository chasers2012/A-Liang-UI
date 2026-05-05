"""Factor registry, validation, dynamic loading, and Alphalens / profile evaluation."""

import app.tool.controller as tool_controller
from app.factors.skills import register_factor_skills
from app.factors.tools import TOOLS
from app.startup_jobs import register_startup_job

register_factor_skills()


@register_startup_job
def register_factor_chat_tools() -> None:
    tool_controller.register_tools(
        TOOLS,
        category="因子",
    )
