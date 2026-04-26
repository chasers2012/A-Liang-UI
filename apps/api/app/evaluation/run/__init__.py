"""Evaluation run execution and persisted results."""

from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_evaluation_run_chat_tools() -> None:
    from app.evaluation.run.tools import (
        delete_evaluation_run,
        get_evaluation_run_detail,
        list_evaluation_runs,
        run_evaluation_run,
    )
    from app.tool.models import ToolAuthorization
    from app.tool.registry import ChatToolRegistry

    tool_defs = [
        ("evaluation_run.run_evaluation_run", run_evaluation_run, ToolAuthorization.allowed),
        ("evaluation_run.list_evaluation_runs", list_evaluation_runs, ToolAuthorization.allowed),
        (
            "evaluation_run.get_evaluation_run_detail",
            get_evaluation_run_detail,
            ToolAuthorization.allowed,
        ),
        ("evaluation_run.delete_evaluation_run", delete_evaluation_run, ToolAuthorization.disabled),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="评价运行",
            authorization=authorization,
        )
