"""Agent built-in node definitions (loader + workspace extensions)."""

from __future__ import annotations

from workflow import Node

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
    """Ordered agent node definitions from the unified workspace registry."""
    return []
