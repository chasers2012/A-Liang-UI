"""LangGraph workflow: ideate -> pseudocode -> codegen -> dry-run -> optional Alphalens -> report."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from agent.nodes import (
    node_evaluate_alphalens,
    node_finalize,
    node_generate_code,
    node_generate_pseudocode,
    node_init_context,
    node_ideate,
    node_validate_dry_run,
)
from agent.state import FactorDiggingState

_MAX_REPAIR_AFTER_FAILURE = 3


def _route_after_validate(state: FactorDiggingState) -> str:
    if state.get("dry_run_ok"):
        return "evaluate"
    if (state.get("repair_count") or 0) < _MAX_REPAIR_AFTER_FAILURE:
        return "regenerate"
    return "finalize"


def build_factor_digging_graph():
    g: StateGraph = StateGraph(FactorDiggingState)
    g.add_node("init_context", node_init_context)
    g.add_node("ideate", node_ideate)
    g.add_node("generate_pseudocode", node_generate_pseudocode)
    g.add_node("generate_code", node_generate_code)
    g.add_node("validate", node_validate_dry_run)
    g.add_node("evaluate", node_evaluate_alphalens)
    g.add_node("finalize", node_finalize)

    g.add_edge(START, "init_context")
    g.add_edge("init_context", "ideate")
    g.add_edge("ideate", "generate_pseudocode")
    g.add_edge("generate_pseudocode", "generate_code")
    g.add_edge("generate_code", "validate")
    g.add_conditional_edges(
        "validate",
        _route_after_validate,
        {"evaluate": "evaluate", "regenerate": "generate_code", "finalize": "finalize"},
    )
    g.add_edge("evaluate", "finalize")
    g.add_edge("finalize", END)
    return g.compile()
