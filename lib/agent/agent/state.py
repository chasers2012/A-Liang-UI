"""Graph state for factor digging."""

from __future__ import annotations

from typing import Any, Final, TypedDict

__all__ = [
    "DEFAULT_DRY_RUN_END_DATE",
    "DEFAULT_DRY_RUN_START_DATE",
    "DEFAULT_EVAL_END_DATE",
    "DEFAULT_EVAL_START_DATE",
    "DEFAULT_FACTOR_DIGGING_EXECUTION",
    "DEFAULT_QUANTILES",
    "FactorDiggingState",
]

# Defaults for dry-run / Alphalens (also used by LangChain tools when no graph state).
DEFAULT_DRY_RUN_START_DATE: Final = "2024-06-01"
DEFAULT_DRY_RUN_END_DATE: Final = "2024-12-31"
DEFAULT_EVAL_START_DATE: Final = "2023-01-01"
DEFAULT_EVAL_END_DATE: Final = "2024-12-31"
DEFAULT_QUANTILES: Final = 5

DEFAULT_FACTOR_DIGGING_EXECUTION: Final[dict[str, Any]] = {
    "dry_run_start_date": DEFAULT_DRY_RUN_START_DATE,
    "dry_run_end_date": DEFAULT_DRY_RUN_END_DATE,
    "eval_start_date": DEFAULT_EVAL_START_DATE,
    "eval_end_date": DEFAULT_EVAL_END_DATE,
    "instrument_codes": None,
    "quantiles": DEFAULT_QUANTILES,
    "skip_alphalens_evaluation": False,
}


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
    dry_run_start_date: str
    dry_run_end_date: str
    eval_start_date: str
    eval_end_date: str
    instrument_codes: list[str] | None
    quantiles: int
    skip_alphalens_evaluation: bool
