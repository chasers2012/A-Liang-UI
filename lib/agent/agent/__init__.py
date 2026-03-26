"""LangGraph-based factor research (digging) agent for quant-agent."""

from __future__ import annotations

from typing import Any

__all__ = ["build_factor_digging_graph", "run_factor_digging"]


def __getattr__(name: str) -> Any:
    if name == "build_factor_digging_graph":
        from agent.graph import build_factor_digging_graph

        return build_factor_digging_graph
    if name == "run_factor_digging":
        from agent.run import run_factor_digging

        return run_factor_digging
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return list(__all__)
