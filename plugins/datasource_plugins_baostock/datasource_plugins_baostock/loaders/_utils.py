from __future__ import annotations

import baostock as bs
import pandas as pd


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
    *,
    start_date: str | None,
    end_date: str | None,
    asset_values: list[str] | None,
) -> tuple[str | None, str | None, list[str] | None]:
    normalized_start = str(pd.Timestamp(start_date).date()) if start_date else None
    normalized_end = str(pd.Timestamp(end_date).date()) if end_date else None
    selected_codes = [str(v).strip() for v in (asset_values or []) if str(v).strip()] or None
    return normalized_start, normalized_end, selected_codes


def quarter_range(start_date: str | None, end_date: str | None) -> list[tuple[int, int]]:
    if not start_date or not end_date:
        return []
    start = pd.Timestamp(start_date)
    end = pd.Timestamp(end_date)
    periods = pd.period_range(start=start, end=end, freq="Q")
    return [(p.year, p.quarter) for p in periods]


def resolve_target_codes(selected_codes: list[str] | None, *, start_date: str | None) -> list[str]:
    if selected_codes:
        return selected_codes

    day = _resolve_first_trading_day_on_or_after(start_date)
    rs = bs.query_all_stock(day=day)
    if str(rs.error_code) != "0":
        raise ValueError(f"BaoStock 查询全市场股票列表失败: {rs.error_msg}")
    df = rs.get_data()
    if df.empty or "code" not in df.columns:
        return []
    return [str(v).strip() for v in df["code"].tolist() if str(v).strip()]


def _resolve_first_trading_day_on_or_after(start_date: str | None) -> str:
    if not start_date:
        return ""

    rs = bs.query_trade_dates(start_date=start_date, end_date=None)
    if str(rs.error_code) != "0":
        raise ValueError(f"BaoStock 查询交易日失败: {rs.error_msg}")
    df = rs.get_data()
    if df.empty or "is_trading_day" not in df.columns or "calendar_date" not in df.columns:
        raise ValueError("BaoStock 查询交易日失败: missing expected columns")
    trading_days = df.loc[df["is_trading_day"].astype(str) == "1", "calendar_date"].tolist()
    if not trading_days:
        raise ValueError(f"BaoStock 查询交易日失败: {start_date} 之后无可用交易日")
    return str(trading_days[0]).strip()
