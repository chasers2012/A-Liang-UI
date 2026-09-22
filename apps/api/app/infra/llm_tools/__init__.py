import app.packages.tool.controller as tool_controller
from .analyze_5w1h_requirement import TOOLS
from app.startup_jobs import register_startup_job


@register_startup_job
def register_llm_tools() -> None:
    tool_controller.register_tools(
        TOOLS,
        category="对话",
    )
