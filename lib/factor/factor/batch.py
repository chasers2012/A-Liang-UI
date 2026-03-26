from __future__ import annotations

from typing import List, Optional, Sequence

import pandas as pd

from factor.datasource import FactorDataSource
from factor.dependency_resolver import panel_load_start_date
from factor.factor import Factor


def merged_dependencies(factors: Sequence[Factor]) -> List[str]:
    """Union of ``Factor.dependencies`` in first-seen order."""
    out: List[str] = []
    for f in factors:
        for col in f.dependencies:
            if col not in out:
                out.append(col)
    return out


def max_lookback(factors: Sequence[Factor]) -> int:
    """Largest ``max_window`` among factors (default 1 if empty)."""
    if not factors:
        return 1
    return max(f.max_window for f in factors)


def compute_factor_values(
    factors: Sequence[Factor],
    price_data: pd.DataFrame,
) -> pd.DataFrame:
    """
    Run ``calculate_from_data`` for each factor and return a wide frame.

    Args:
        factors: Concrete ``Factor`` instances.
        price_data: MultiIndex (date, asset) with all columns any factor needs.

    Returns:
        DataFrame, same index as ``price_data``, one column per ``factor.name``.
    """
    if not factors:
        return pd.DataFrame(index=price_data.index)

    series_by_name: dict[str, pd.Series] = {}
    for f in factors:
        series_by_name[f.name] = f.calculate_from_data(price_data)
    return pd.DataFrame(series_by_name, index=price_data.index)


def compute_factor_values_from_source(
    factors: Sequence[Factor],
    data_source: FactorDataSource,
    *,
    start_date: Optional[str],
    end_date: str,
    stock_codes: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Load a single panel (merged fields, max lookback) and compute all factors.
    """
    if not factors:
        return pd.DataFrame()

    fields = merged_dependencies(factors)
    window = max_lookback(factors)
    load_start = panel_load_start_date(start_date, end_date, window)
    panel = data_source.get_panel(
        fields=fields,
        start_date=load_start,
        end_date=end_date,
        stock_codes=stock_codes,
    )
    return compute_factor_values(factors, panel)
