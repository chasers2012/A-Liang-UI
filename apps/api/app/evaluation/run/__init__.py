"""Factor evaluation execution and persisted results."""

from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_evaluation_run_chat_tools() -> None:
    from app.chat.tool_registry import ChatToolRegistry
    from app.evaluation.run.tools import EVALUATION_RUN_CHAT_TOOLS

    for tool in EVALUATION_RUN_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
