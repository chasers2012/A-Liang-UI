from __future__ import annotations

import pandas as pd
from factor.datasource import BetweenFilter, InFilter, LoadFilter


def as_dataframe(rs, *, columns: list[str] | None = None) -> pd.DataFrame:
    df = rs.get_data()
    if not isinstance(df, pd.DataFrame):
        df = pd.DataFrame(df)
    if columns:
        available = [col for col in columns if col in df.columns]
        if available:
            return df.loc[:, available]
    return df


def extract_code_dates(
    filters: list[LoadFilter] | None,
) -> tuple[str | None, str | None, list[str] | None]:
    start_date: str | None = None
    end_date: str | None = None
    selected_codes: list[str] | None = None
    for flt in filters or []:
        if isinstance(flt, BetweenFilter):
            start_date = str(pd.Timestamp(flt.start).date())
            end_date = str(pd.Timestamp(flt.end).date())
        elif isinstance(flt, InFilter):
            if flt.column != "code":
                continue
            selected_codes = [str(v).strip() for v in (flt.values or []) if str(v).strip()]
        else:
            raise TypeError(f"Unsupported filter: {type(flt)!r}")
    return start_date, end_date, selected_codes


def quarter_range(start_date: str | None, end_date: str | None) -> list[tuple[int, int]]:
    if not start_date or not end_date:
        return []
    start = pd.Timestamp(start_date)
    end = pd.Timestamp(end_date)
    periods = pd.period_range(start=start, end=end, freq="Q")
    return [(p.year, p.quarter) for p in periods]
