"""Evaluation metric registry: CRUD schemas and persistence.

Workflow/runtime integration code lives under :mod:`app.evaluation.metric_workflow`.
"""

from __future__ import annotations

from app.startup_jobs import register_startup_job


@register_startup_job
def register_evaluation_metric_chat_tools() -> None:
    from app.evaluation.metrics.tools import EVALUATION_METRIC_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in EVALUATION_METRIC_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)
