from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Any

import pandas as pd

if TYPE_CHECKING:
    from vectorbt.portfolio.base import Portfolio


def parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    datetime_cols = df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns

    df[datetime_cols] = df[datetime_cols].astype(str)
    return df


def safe_series_to_dict(s: pd.Series) -> dict:
    s = s.copy()

    # 处理 index（如果 index 是 DatetimeIndex）
    if isinstance(s.index, pd.DatetimeIndex):
        s.index = s.index.astype(str)

    # 处理 value
    for k, v in s.items():
        if isinstance(v, (pd.Timestamp, datetime.datetime, datetime.date, pd.Timedelta)):
            s[k] = str(v)

    return s.to_dict()


def parse_equity_curve(pf: Portfolio) -> list[dict[str, Any]]:
    value = pf.value()
    if value is None:
        return []
    if isinstance(value, pd.DataFrame):
        # vectorbt may return per-asset portfolio values; aggregate to a single
        # total equity series so the frontend chart can render one curve.
        value = value.sum(axis=1)
    if not isinstance(value, pd.Series):
        return []

    frame = value.rename("value").reset_index()
    frame.columns = ["date", "value"] if len(frame.columns) >= 2 else frame.columns

    return parse_dates(frame).to_dict(orient="records")


def parse_stats(pf: Portfolio) -> dict[str, Any]:
    s = pf.stats()
    if s is None:
        return {}
    if isinstance(s, pd.Series):
        return safe_series_to_dict(s)
    if isinstance(s, pd.DataFrame):
        return parse_dates(s).to_dict(orient="records")
    return dict(s)


def parse_trades(pf: Portfolio) -> list[dict[str, Any]]:
    recs = pf.trades.records_readable
    if not isinstance(recs, pd.DataFrame):
        return []

    drop_cols = [col for col in ["index", "Exit Trade Id", "Position Id"] if col in recs.columns]
    if drop_cols:
        recs = recs.drop(columns=drop_cols)
    sort_cols = [
        col for col in ["Entry Timestamp", "Exit Timestamp", "Trade Id"] if col in recs.columns
    ]
    if sort_cols:
        recs = recs.sort_values(by=sort_cols, kind="stable")
    return parse_dates(recs).reset_index(drop=True).to_dict(orient="records")


def portfolio_to_results_dict(pf: Portfolio) -> dict[str, Any]:
    return {
        "stats": parse_stats(pf),
        "equity_curve": parse_equity_curve(pf),
        "trades": parse_trades(pf),
    }
