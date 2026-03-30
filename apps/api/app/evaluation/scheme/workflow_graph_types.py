"""Evaluation workflow node types from the unified evaluation NodeCatalog."""

from __future__ import annotations

from workflow import Node, NodeCatalog, WorkflowGraph, WorkflowNode

from app.workflow_nodes import load_domain_node_catalog


def get_evaluation_node_catalog() -> NodeCatalog:
    """Load evaluation domain catalog from ``workflow_nodes/evaluation/*``."""
    return load_domain_node_catalog("evaluation")


def resolve_evaluation_workflow_node_type_to_fqn(node_type: str) -> str:
    """Return ``node.type`` as stored: the catalog key (``module.qualname`` of the node class)."""
    return (node_type or "").strip()


def sorted_workflow_node_type_ids() -> list[str]:
    """All evaluation node type keys (class FQNs) in lexicographic order."""
    return sorted(get_evaluation_node_catalog().specs.keys())


def all_workflow_node_type_ids() -> frozenset[str]:
    return frozenset(get_evaluation_node_catalog().specs.keys())


def workflow_node_definition(node_type: str) -> Node:
    nt = (node_type or "").strip()
    resolved = resolve_evaluation_workflow_node_type_to_fqn(nt)
    spec = get_evaluation_node_catalog().specs.get(resolved)
    if spec is None:
        raise KeyError(nt)
    return spec


def workflow_node_definition_or_fail(node_type: str) -> Node:
    try:
        return workflow_node_definition(node_type)
    except KeyError as e:
        raise ValueError(f"未知节点类型: {node_type!r}") from e


def normalize_evaluation_workflow_node_types(workflow: WorkflowGraph) -> WorkflowGraph:
    """Normalize each node's ``type`` (trimmed catalog key)."""
    nodes: list[WorkflowNode] = [
        n.model_copy(update={"type": resolve_evaluation_workflow_node_type_to_fqn(n.type)})
        for n in workflow.nodes
    ]
    return workflow.model_copy(update={"nodes": nodes})
