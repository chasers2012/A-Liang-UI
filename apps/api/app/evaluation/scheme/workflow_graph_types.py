"""Evaluation workflow node types from the merged workspace + factor registry."""

from __future__ import annotations

import functools

from workflow import Node, NodeRegistry, WorkflowGraph, merge_node_registries

from app.evaluation.factor_workflow_nodes import build_factor_workflow_node_registry
from app.workflow_nodes import load_workspace_node_registry


def _is_evaluation_catalog_type_id(type_id: str) -> bool:
    """Exclude agent built-in nodes from evaluation profile catalog / allowed types."""
    tid = (type_id or "").strip()
    if not tid:
        return False
    return not tid.startswith("agent_workflow_nodes.")


@functools.lru_cache(maxsize=1)
def get_evaluation_node_registry() -> NodeRegistry:
    """Full workspace node registry plus per-factor nodes (handlers for execution / validation).

    Cached per process; clear with ``get_evaluation_node_registry.cache_clear()`` if
    workspace node packages change at runtime (e.g. in tests).
    """
    base = load_workspace_node_registry()
    return merge_node_registries(base, build_factor_workflow_node_registry())


def sorted_workflow_node_type_ids() -> list[str]:
    """Evaluation-profile node type keys (excludes ``agent_workflow_nodes.*``), sorted."""
    reg = get_evaluation_node_registry()
    return sorted(t for t in reg if _is_evaluation_catalog_type_id(t))


def all_workflow_node_type_ids() -> frozenset[str]:
    return frozenset(t for t in get_evaluation_node_registry() if _is_evaluation_catalog_type_id(t))


def workflow_node_definition(node_type: str) -> Node:
    nt = (node_type or "").strip()
    reg = get_evaluation_node_registry().get(nt)
    if reg is None:
        raise KeyError(nt)
    return reg.definition


def workflow_node_definition_or_fail(node_type: str) -> Node:
    try:
        return workflow_node_definition(node_type)
    except KeyError as e:
        raise ValueError(f"未知节点类型: {node_type!r}") from e


def normalize_evaluation_workflow_node_types(workflow: WorkflowGraph) -> WorkflowGraph:
    """Normalize each node's ``type`` (trimmed catalog key)."""
    nodes: list[Node] = [
        n.model_copy(update={"type": (n.type or "").strip()}) for n in workflow.nodes
    ]
    return workflow.model_copy(update={"nodes": nodes})
