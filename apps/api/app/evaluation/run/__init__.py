"""Evaluation run execution and persisted results."""

from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_evaluation_run_chat_tools() -> None:
    from app.evaluation.run.tools import EVALUATION_RUN_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in EVALUATION_RUN_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool, category="evaluation_run")
