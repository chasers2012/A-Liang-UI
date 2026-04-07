"""Evaluation metric registry: CRUD schemas and persistence.

Workflow/runtime integration code lives under :mod:`app.evaluation.metric_workflow`.
"""

from __future__ import annotations

from functools import lru_cache

from app.evaluation.metrics.seed_internal import seed_internal_evaluation_metric_package
from app.startup_jobs import register_startup_job


@register_startup_job
def register_evaluation_metric_chat_tools() -> None:
    from app.chat.tool_registry import ChatToolRegistry
    from app.evaluation.metrics.tools import EVALUATION_METRIC_CHAT_TOOLS

    for tool in EVALUATION_METRIC_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool)


@register_startup_job
def _register_evaluation_workflow_node_segment() -> None:
    seed_internal_evaluation_metric_package()

    # Register metric-id -> NodeClass mapping in WorkflowNodeLoader so workflow
    # JSON can keep storing evaluation metric ids as `node.type`.
    from workflow import Node, WorkflowNodeLoader

    from app.evaluation.metrics.controller import (
        get_metric_record,
        list_metric_records,
        read_metric_source,
    )

    @lru_cache(maxsize=256)
    def _metric_id_to_node_cls(type_key: str) -> type[Node] | None:
        rec = get_metric_record(type_key)
        if rec is None:
            return None
        src = read_metric_source(rec)
        return WorkflowNodeLoader.load_workflow_node_class_from_source(src)  # type: ignore[return-value]

    loader = WorkflowNodeLoader.instance()
    for metric in list_metric_records():
        try:
            node_cls = _metric_id_to_node_cls(metric.id)
        except Exception:
            continue
        if node_cls is not None:
            loader.register_node(metric.id, node_cls)
