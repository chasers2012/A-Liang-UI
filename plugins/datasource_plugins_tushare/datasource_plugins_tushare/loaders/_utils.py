from __future__ import annotations

import re

import pandas as pd

from ..client import call_pro

_TS_CODE_RE = re.compile(r"^(\d{6})\.(SH|SZ|BJ)$", re.IGNORECASE)
_BAOSTOCK_CODE_RE = re.compile(r"^(sh|sz|bj)\.(\d{6})$", re.IGNORECASE)


def to_tushare_date(value: str | None) -> str | None:
    if not value:
        return None
    ts = pd.Timestamp(value)
    return ts.strftime("%Y%m%d")


def to_ts_code(code: str) -> str:
    raw = str(code).strip()
    if not raw:
        return raw
    upper = raw.upper()
    m = _TS_CODE_RE.match(upper)
    if m:
        return f"{m.group(1)}.{m.group(2).upper()}"
    m = _BAOSTOCK_CODE_RE.match(raw)
    if m:
        market = m.group(1).upper()
        suffix = {"SH": "SH", "SZ": "SZ", "BJ": "BJ"}[market]
        return f"{m.group(2)}.{suffix}"
    digits = re.sub(r"\D", "", raw)
    if len(digits) != 6:
        return upper
    lower = raw.lower()
    if lower.startswith(("sh", "sz", "bj")):
        market = lower[:2]
        suffix = market.upper()
        return f"{digits}.{suffix}"
    if digits.startswith(("5", "6", "9")):
        return f"{digits}.SH"
    if digits.startswith(("4", "8")):
        return f"{digits}.BJ"
    return f"{digits}.SZ"


def normalize_ts_codes(values: list[str] | None) -> list[str] | None:
    if not values:
        return None
    out = [to_ts_code(v) for v in values if str(v).strip()]
    return out or None


def extract_code_dates(
    *,
    start_date: str | None,
    end_date: str | None,
    asset_values: list[str] | None,
) -> tuple[str | None, str | None, list[str] | None]:
    start = to_tushare_date(start_date)
    end = to_tushare_date(end_date)
    codes = normalize_ts_codes(asset_values)
    return start, end, codes


def select_columns(df: pd.DataFrame, columns: list[str] | None) -> pd.DataFrame:
    if df.empty or not columns:
        return df
    available = [col for col in columns if col in df.columns]
    if available:
        return df.loc[:, available]
    return df


def resolve_target_codes(
    token: str | None,
    selected_codes: list[str] | None,
    *,
    list_status: str = "L",
) -> list[str]:
    if selected_codes:
        return selected_codes
    df = call_pro(
        token,
        "stock_basic",
        exchange="",
        list_status=list_status,
        fields="ts_code",
    )
    if df.empty or "ts_code" not in df.columns:
        return []
    return [str(v).strip() for v in df["ts_code"].tolist() if str(v).strip()]
