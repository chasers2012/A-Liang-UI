from __future__ import annotations

from collections.abc import Callable
from typing import Any

import baostock as bs
import pandas as pd
from tqdm import tqdm

from ._utils import extract_code_dates, resolve_target_codes

STOCK_K_DATA_DOC = "https://baostock.com/mainContent?file=stockKData.md"
BAOSTOCK_API_NAME = "query_history_k_data_plus"

MINUTE_FREQUENCIES = frozenset({"5", "15", "30", "60"})
WEEKLY_MONTHLY_FREQUENCIES = frozenset({"w", "m"})

DAILY_FIELDS: tuple[str, ...] = (
    "date",
    "code",
    "open",
    "high",
    "low",
    "close",
    "preclose",
    "volume",
    "amount",
    "adjustflag",
    "turn",
    "tradestatus",
    "pctChg",
    "peTTM",
    "psTTM",
    "pcfNcfTTM",
    "pbMRQ",
    "isST",
)
WEEKLY_MONTHLY_FIELDS: tuple[str, ...] = (
    "date",
    "code",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "amount",
    "adjustflag",
    "turn",
    "pctChg",
)
MINUTE_FIELDS: tuple[str, ...] = (
    "date",
    "time",
    "code",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "amount",
    "adjustflag",
)

FIELD_LABELS: dict[str, str] = {
    "date": "交易所行情日期",
    "time": "交易所行情时间",
    "code": "证券代码",
    "open": "开盘价",
    "high": "最高价",
    "low": "最低价",
    "close": "收盘价",
    "preclose": "前收盘价",
    "volume": "成交量",
    "amount": "成交额",
    "adjustflag": "复权状态",
    "turn": "换手率",
    "tradestatus": "交易状态",
    "pctChg": "涨跌幅",
    "peTTM": "滚动市盈率",
    "psTTM": "滚动市销率",
    "pcfNcfTTM": "滚动市现率",
    "pbMRQ": "市净率",
    "isST": "是否ST",
}

ADJUSTFLAG_OPTIONS = ["1", "2", "3"]
ADJUSTFLAG_LABELS = ["后复权", "前复权", "不复权"]
ADJUSTFLAG_ONE_OF = [
    {"const": key, "title": label}
    for key, label in zip(ADJUSTFLAG_OPTIONS, ADJUSTFLAG_LABELS, strict=True)
]


def adjustflag_config_schema() -> dict[str, Any]:
    return {
        "type": "string",
        "title": "复权类型",
        "description": "1=后复权、2=前复权、3=不复权（默认）。已支持日/周/月/分钟前后复权。",
        "oneOf": ADJUSTFLAG_ONE_OF,
        "default": "3",
    }


def frequency_config_schema(
    *,
    options: list[str],
    labels: list[str],
    default: str,
    description: str,
) -> dict[str, Any]:
    return {
        "type": "string",
        "title": "K线周期",
        "description": description,
        "oneOf": [
            {"const": key, "title": label} for key, label in zip(options, labels, strict=True)
        ],
        "default": default,
    }


def is_baostock_index_code(code: str) -> bool:
    c = str(code).strip().lower()
    if "." not in c:
        return False
    market, num = c.split(".", 1)
    return (market == "sh" and num.startswith("000")) or (market == "sz" and num.startswith("399"))


def _filter_minute_codes(codes: list[str]) -> list[str]:
    stocks = [c for c in codes if not is_baostock_index_code(c)]
    skipped = [c for c in codes if is_baostock_index_code(c)]
    if skipped and not stocks:
        raise ValueError(
            f"分钟线不支持指数代码（{', '.join(skipped[:3])}"
            f"{'…' if len(skipped) > 3 else ''}），请改用日/周/月线或更换标的。"
            f"说明见 {STOCK_K_DATA_DOC}"
        )
    return stocks


def _normalize_fields(fields: list[str], allowed: frozenset[str]) -> list[str]:
    normalized = [str(f).strip() for f in fields if str(f).strip()]
    return [f for f in normalized if f in allowed]


def create_load_frame(
    *,
    resolve_frequency: Callable[[dict], str],
    fields: tuple[str, ...],
    base_keys: frozenset[str],
    tqdm_desc: str,
    filter_minute_index_codes: bool = False,
) -> Callable[..., pd.DataFrame]:
    allowed = frozenset(fields)
    default_fields = [f for f in fields if f not in base_keys]

    def load_frame(
        *,
        columns: list[str],
        start_date: str | None = None,
        end_date: str | None = None,
        asset_values: list[str] | None = None,
        config: dict,
    ) -> pd.DataFrame:
        frequency = resolve_frequency(config)
        requested_cols = sorted(
            {str(c).strip() for c in columns if str(c).strip() and str(c).strip() in allowed}
        )
        selected_fields = _normalize_fields(config.get("fields", []), allowed)
        start_date, end_date, selected_codes = extract_code_dates(
            start_date=start_date, end_date=end_date, asset_values=asset_values
        )
        api_fn = getattr(bs, BAOSTOCK_API_NAME, None)
        if api_fn is None or not callable(api_fn):
            raise ValueError(f"baostock 未找到接口: {BAOSTOCK_API_NAME}")
        if not selected_fields:
            selected_fields = list(default_fields)
        target_codes = resolve_target_codes(selected_codes, start_date=start_date)
        if filter_minute_index_codes:
            target_codes = _filter_minute_codes(target_codes)
        effective_cols = sorted(
            {c for c in set(requested_cols) | set(selected_fields) | base_keys if c in allowed}
        )
        frames: list[pd.DataFrame] = []
        for code in tqdm(target_codes, desc=tqdm_desc, unit="只"):
            rs = bs.query_history_k_data_plus(
                code=code,
                fields=",".join(effective_cols),
                start_date=start_date,
                end_date=end_date,
                frequency=frequency,
                adjustflag=str(config.get("adjustflag", "3")),
            )
            if str(rs.error_code) != "0":
                raise ValueError(f"BaoStock 查询失败({code}): {rs.error_msg}")
            df = rs.get_data()
            if not df.empty:
                frames.append(df)
        if not frames:
            return (
                pd.DataFrame(columns=requested_cols)
                if requested_cols
                else pd.DataFrame(columns=effective_cols)
            )
        out = pd.concat(frames, ignore_index=True)
        return out.loc[:, requested_cols] if requested_cols else out

    return load_frame


def resolve_weekly_monthly_frequency(config: dict) -> str:
    frequency = str(config.get("frequency", "w")).strip().lower()
    if frequency in WEEKLY_MONTHLY_FREQUENCIES:
        return frequency
    return "w"


def resolve_minute_frequency(config: dict) -> str:
    frequency = str(config.get("frequency", "5")).strip().lower()
    if frequency in MINUTE_FREQUENCIES:
        return frequency
    return "5"
