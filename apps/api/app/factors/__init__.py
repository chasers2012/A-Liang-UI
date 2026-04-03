"""Factor registry, validation, dynamic loading, and Alphalens / profile evaluation."""

from app.evaluation.metrics.seed_internal import (
    seed_internal_evaluation_metric_package as seed_internal_evaluation_metric_package,
)
from app.startup_jobs import register_startup_job


@register_startup_job
def register_factor_chat_tools() -> None:
    from app.chat.tool_registry import ChatToolRegistry
    from app.factors.tools import FACTOR_CHAT_TOOLS

    for tool in FACTOR_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
