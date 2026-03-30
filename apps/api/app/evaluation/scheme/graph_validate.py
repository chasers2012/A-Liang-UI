"""Validate evaluation workflow graph — thin wrapper over workflow.validate."""

from __future__ import annotations

from collections.abc import Set as AbstractSet

from workflow import Node
from workflow import validate_workflow_graph as _validate_generic

from .profile_schemas import EvaluationWorkflow
from .workflow_graph_types import (
    get_evaluation_node_catalog,
    resolve_evaluation_workflow_node_type_to_fqn,
)


def validate_workflow_graph(
    workflow: EvaluationWorkflow,
    *,
    allowed_types: AbstractSet[str],
) -> None:
    """Validate DAG structure and sockets for an evaluation workflow.

    ``node.type`` must be the catalog key (class ``module.qualname``) and in ``allowed_types``.
    """
    cat = get_evaluation_node_catalog()
    specs: dict[str, Node] = {}
    for n in workflow.nodes:
        t = (n.type or "").strip()
        if not t:
            raise ValueError(f"节点 {n.id!r} 的 type 不能为空")
        resolved = resolve_evaluation_workflow_node_type_to_fqn(t)
        if resolved not in cat.specs:
            raise ValueError(f"未知节点类型: {t!r}")
        if resolved not in allowed_types:
            raise ValueError(f"不允许的节点类型: {t!r}")
        specs[t] = cat.specs[resolved]
    _validate_generic(workflow, node_type_specs=specs)
