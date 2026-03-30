"""Agent built-in node specs and handlers (loader + workspace extensions)."""

from __future__ import annotations

from workflow import Node, ordered_specs

from app.workflow_nodes import load_domain_node_catalog

AGENT_NODE_ORDER: list[str] = [
    "agent_workflow_nodes.init_context.InitContextNode",
    "agent_workflow_nodes.ideate.IdeateNode",
    "agent_workflow_nodes.generate_pseudocode.GeneratePseudocodeNode",
    "agent_workflow_nodes.generate_code.GenerateCodeNode",
    "agent_workflow_nodes.validate_node.ValidateNode",
    "agent_workflow_nodes.evaluate_node.EvaluateNode",
    "agent_workflow_nodes.finalize.FinalizeNode",
]


def get_agent_node_types() -> list[Node]:
    """Ordered node specs for the agent domain (uses current :func:`workspace.get_workspace_root`)."""
    cat = load_domain_node_catalog("agent")
    return ordered_specs(cat.specs, AGENT_NODE_ORDER)
