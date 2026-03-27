"""Graph state for factor digging."""

from __future__ import annotations

from typing import TypedDict

__all__ = ["FactorDiggingState"]


class FactorDiggingState(TypedDict, total=False):
    user_prompt: str
    available_fields: list[str]
    research_idea: str
    pseudocode: str
    factor_source: str
    factor_class_name: str
    dry_run_error: str | None
    repair_count: int
    dry_run_ok: bool
    evaluation_summary: str
    evaluation_error: str | None
    final_report: str
