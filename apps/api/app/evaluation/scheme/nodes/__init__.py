"""Evaluation built-in node specs and handlers (loader + workspace extensions)."""

from __future__ import annotations

from workflow import NodeHandler, NodeSpec

from app.workflow_nodes import load_domain_node_catalog

VIZ_NODE_TYPE_PREFIX = "viz_"

_EVAL_CATALOG = load_domain_node_catalog("evaluation")

BUILTIN_NODE_SPECS: dict[str, NodeSpec] = _EVAL_CATALOG.specs
BUILTIN_HANDLERS: dict[str, NodeHandler] = _EVAL_CATALOG.handlers


def sorted_viz_node_type_ids() -> list[str]:
    return sorted(
        tid for tid in BUILTIN_NODE_SPECS if (tid or "").strip().startswith(VIZ_NODE_TYPE_PREFIX)
    )
