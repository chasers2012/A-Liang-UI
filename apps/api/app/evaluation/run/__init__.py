"""Evaluation run execution and persisted results."""

from __future__ import annotations

import app.tool.controller as tool_controller
from app.evaluation.run.tools import TOOLS
from app.startup_jobs import register_startup_job


@register_startup_job
def register_evaluation_run_chat_tools() -> None:
    tool_controller.register_tools(
        TOOLS,
        category="评价运行",
    )
