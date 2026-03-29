"""Agent built-in node specs and handlers (loader + workspace extensions)."""

from __future__ import annotations

from workflow import Node, ordered_specs

from app.workflow_nodes import load_domain_node_catalog

_AGENT_CATALOG = load_domain_node_catalog("agent")

AGENT_NODE_ORDER: list[str] = [
    "init_context",
    "ideate",
    "generate_pseudocode",
    "generate_code",
    "validate",
    "evaluate",
    "finalize",
]

AGENT_NODE_TYPES: list[Node] = ordered_specs(_AGENT_CATALOG.specs, AGENT_NODE_ORDER)
