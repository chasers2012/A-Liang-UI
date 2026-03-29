"""Pandas helpers shared by workflow nodes and evaluation runner (no app imports)."""

from __future__ import annotations

import pandas as pd


def series_to_period_dict(s: pd.Series) -> dict[str, float]:
    out: dict[str, float] = {}
    for k, v in s.items():
        if pd.isna(v):
            continue
        key = str(int(k)) if isinstance(k, (int, float)) and float(k) == int(k) else str(k)
        out[key] = float(v)
    return out


def stock_count_from_alignment(idx: pd.Index) -> int | None:
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
