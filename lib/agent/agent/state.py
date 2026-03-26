"""Graph state for factor digging."""

from __future__ import annotations

from typing import List, Optional, TypedDict


class FactorDiggingState(TypedDict, total=False):
    user_prompt: str
    available_fields: List[str]
    research_idea: str
    pseudocode: str
    factor_source: str
    factor_class_name: str
    dry_run_error: Optional[str]
    repair_count: int
    dry_run_ok: bool
    evaluation_summary: str
    evaluation_error: Optional[str]
    final_report: str
