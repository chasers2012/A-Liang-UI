"""Evaluation workflow node types from the unified evaluation NodeCatalog."""

from __future__ import annotations

from workflow import Node, NodeCatalog, WorkflowGraph, WorkflowNode, merge_node_catalogs

from app.evaluation.factor_workflow_nodes import build_factor_workflow_node_catalog
from app.workflow_nodes import load_domain_node_catalog


def get_evaluation_node_catalog() -> NodeCatalog:
    """Built-in evaluation packages plus per-factor nodes from the workspace registry."""
    base = load_domain_node_catalog("evaluation")
    return merge_node_catalogs(base, build_factor_workflow_node_catalog())


_LEGACY_PREPARE = "evaluation_workflow_nodes.prepare_alphalens.PrepareAlphalensNode"
_CURRENT_CALC = "evaluation_workflow_nodes.calculate_factor_value.CalculateFactorValueNode"


def resolve_evaluation_workflow_node_type_to_fqn(node_type: str) -> str:
    """Return catalog key; map legacy prepare node id to :class:`CalculateFactorValueNode`."""
    t = (node_type or "").strip()
    if t == _LEGACY_PREPARE:
        return _CURRENT_CALC
    return t


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
