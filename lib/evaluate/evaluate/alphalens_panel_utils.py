"""Pandas helpers shared by workflow nodes and evaluation runner (no app imports)."""

from __future__ import annotations

from typing import Any

import pandas as pd


def series_to_period_dict(s: pd.Series) -> dict[str, float]:
    out: dict[str, float] = {}
    for k, v in s.items():
        if pd.isna(v):
            continue
        key = str(int(k)) if isinstance(k, (int, float)) and float(k) == int(k) else str(k)
        out[key] = float(v)
    return out


def jsonable_metric_value(val: Any) -> Any:
    """Normalize metric outputs (Series/dict/scalar) for JSON-friendly workflow results."""
    if isinstance(val, pd.Series):
        return series_to_period_dict(val)
    if isinstance(val, dict):
        return {str(k): float(v) for k, v in val.items() if not pd.isna(v)}
    return val


def instrument_count_from_alignment(idx: pd.Index) -> int | None:
    if not isinstance(idx, pd.MultiIndex):
        return None
    try:
        lev = idx.get_level_values("asset")
    except (KeyError, IndexError, ValueError):
        try:
            lev = idx.get_level_values(-1)
        except Exception:
            return None
    return int(lev.nunique())
