from __future__ import annotations

from collections.abc import Sequence

import pandas as pd

from factor.data_set import DataSet, DataSourceBinding
from factor.factor import Factor


def merged_dependencies(factors: Sequence[Factor]) -> list[str]:
    """Union of factor dependency fields in first-seen order."""
    out: list[str] = []
    for f in factors:
        for col in f.dependency_fields():
            if col not in out:
                out.append(col)
    return out


def max_lookback(factors: Sequence[Factor]) -> int:
    """Largest ``window`` among factors (default 1 if empty)."""
    if not factors:
        return 1
    return max(f.window for f in factors)


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
    binding: DataSourceBinding,
    *,
    start_date: str | None,
    end_date: str,
    instrument_codes: list[str] | None = None,
) -> pd.DataFrame:
    """
    Load a single panel (merged fields, max lookback) and compute all factors.
    """
    if not factors:
        return pd.DataFrame()

    fields = merged_dependencies(factors)
    window = max_lookback(factors)
    ds = DataSet([binding])
    panel = ds.get_panel(
        fields=fields,
        start_date=start_date,
        end_date=end_date,
        instrument_codes=instrument_codes,
        window=window,
    )
    return compute_factor_values(factors, panel)
