"""Evaluation workflow node types from the unified evaluation NodeCatalog."""

from __future__ import annotations

from workflow import Node, NodeCatalog

from app.workflow_nodes import load_domain_node_catalog


def get_evaluation_node_catalog() -> NodeCatalog:
    """Load evaluation domain catalog from ``workflow_nodes/evaluation/*``."""
    return load_domain_node_catalog("evaluation")


def sorted_workflow_node_type_ids() -> list[str]:
    """All evaluation node type ids in lexicographic order."""
    return sorted(get_evaluation_node_catalog().specs.keys())


def all_workflow_node_type_ids() -> frozenset[str]:
    return frozenset(get_evaluation_node_catalog().specs.keys())


def workflow_node_definition(node_type: str) -> Node:
    nt = (node_type or "").strip()
    spec = get_evaluation_node_catalog().specs.get(nt)
    if spec is None:
        raise KeyError(nt)
    return spec


def workflow_node_definition_or_fail(node_type: str) -> Node:
    try:
        return workflow_node_definition(node_type)
    except KeyError as e:
        raise ValueError(f"未知节点类型: {node_type!r}") from e
