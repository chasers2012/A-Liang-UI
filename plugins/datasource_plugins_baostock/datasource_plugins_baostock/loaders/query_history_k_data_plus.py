from __future__ import annotations

import baostock as bs
import pandas as pd
from tqdm import tqdm

from ._utils import extract_code_dates, resolve_target_codes

# 官方文档：https://baostock.com/mainContent?file=stockKData.md
STOCK_K_DATA_DOC = "https://baostock.com/mainContent?file=stockKData.md"

API_NAME = "query_history_k_data_plus"
ASSET_COLUMN: str | None = "code"
TIME_COLUMN: str = "date"

# frequency：d=日k、w=周、m=月、5/15/30/60=分钟（文档「参数含义」）
MINUTE_FREQUENCIES = frozenset({"5", "15", "30", "60"})
WEEKLY_MONTHLY_FREQUENCIES = frozenset({"w", "m"})

# 历史行情指标参数 — 与文档示例及指标表一致（顺序同 stockKData.md）
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

FREQUENCY_OPTIONS = ["d", "w", "m", "5", "15", "30", "60"]
FREQUENCY_LABELS = ["日K线", "周K线", "月K线", "5分钟", "15分钟", "30分钟", "60分钟"]
FREQUENCY_ONE_OF = [
    {"const": key, "title": label}
    for key, label in zip(FREQUENCY_OPTIONS, FREQUENCY_LABELS, strict=True)
]
ADJUSTFLAG_OPTIONS = ["1", "2", "3"]
ADJUSTFLAG_LABELS = ["后复权", "前复权", "不复权"]
ADJUSTFLAG_ONE_OF = [
    {"const": key, "title": label}
    for key, label in zip(ADJUSTFLAG_OPTIONS, ADJUSTFLAG_LABELS, strict=True)
]

K_DATA_FIELD_OPTIONS = [
    (name, FIELD_LABELS[name])
    for name in dict.fromkeys([*DAILY_FIELDS, *WEEKLY_MONTHLY_FIELDS, *MINUTE_FIELDS])
    if name not in ("date", "code", "time")
]
K_DATA_FIELDS = [key for key, _ in K_DATA_FIELD_OPTIONS]
K_DATA_FIELD_ONE_OF = [{"const": key, "title": label} for key, label in K_DATA_FIELD_OPTIONS]

json_schema = {
    "type": "object",
    "properties": {
        "frequency": {
            "type": "string",
            "title": "K线周期",
            "description": (
                "d=日K、w=周K、m=月K、5/15/30/60=分钟K。"
                "周线仅每周最后交易日、月线仅每月最后交易日可获取；"
                "分钟线不包含指数。"
                f"详见 {STOCK_K_DATA_DOC}"
            ),
            "oneOf": FREQUENCY_ONE_OF,
            "default": "d",
        },
        "adjustflag": {
            "type": "string",
            "title": "复权类型",
            "description": "1=后复权、2=前复权、3=不复权（默认）。已支持日/周/月/分钟前后复权。",
            "oneOf": ADJUSTFLAG_ONE_OF,
            "default": "3",
        },
    },
    "required": [],
}


def normalize_frequency(frequency: str | None) -> str:
    f = str(frequency or "d").strip().lower()
    if f in MINUTE_FREQUENCIES or f in WEEKLY_MONTHLY_FREQUENCIES or f == "d":
        return f
    return "d"


def fields_for_frequency(frequency: str | None) -> list[str]:
    """返回当前 frequency 在 stockKData.md 中允许的 fields 列表。"""
    f = normalize_frequency(frequency)
    if f in MINUTE_FREQUENCIES:
        return list(MINUTE_FIELDS)
    if f in WEEKLY_MONTHLY_FREQUENCIES:
        return list(WEEKLY_MONTHLY_FIELDS)
    return list(DAILY_FIELDS)


def allowed_field_set(frequency: str | None) -> frozenset[str]:
    return frozenset(fields_for_frequency(frequency))


def is_baostock_index_code(code: str) -> bool:
    """指数代码（分钟线不支持，见 stockKData.md）。"""
    c = str(code).strip().lower()
    if "." not in c:
        return False
    market, num = c.split(".", 1)
    return (market == "sh" and num.startswith("000")) or (market == "sz" and num.startswith("399"))


def _filter_minute_codes(codes: list[str], frequency: str) -> list[str]:
    if frequency not in MINUTE_FREQUENCIES:
        return codes
    stocks = [c for c in codes if not is_baostock_index_code(c)]
    skipped = [c for c in codes if is_baostock_index_code(c)]
    if skipped and not stocks:
        raise ValueError(
            f"分钟线不支持指数代码（{', '.join(skipped[:3])}"
            f"{'…' if len(skipped) > 3 else ''}），请改用日/周/月线或更换标的。"
            f"说明见 {STOCK_K_DATA_DOC}"
        )
    return stocks


FIXED_COLUMNS = sorted({col for freq in FREQUENCY_OPTIONS for col in fields_for_frequency(freq)})


def _normalize_fields(fields: list[str], allowed: frozenset[str]) -> list[str]:
    normalized = [str(f).strip() for f in fields if str(f).strip()]
    return [f for f in normalized if f in allowed]


def _base_keys_for_frequency(frequency: str) -> set[str]:
    if frequency in MINUTE_FREQUENCIES:
        return {"date", "time", "code"}
    return {"date", "code"}


def load_frame(
    *,
    columns: list[str],
    date_column: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    asset_column: str | None = None,
    asset_values: list[str] | None = None,
    config: dict,
) -> pd.DataFrame:
    _ = date_column, asset_column
    frequency = normalize_frequency(config.get("frequency", "d"))
    allowed = allowed_field_set(frequency)
    base_keys = _base_keys_for_frequency(frequency)
    default_fields = [f for f in fields_for_frequency(frequency) if f not in base_keys]

    requested_cols = sorted(
        {str(c).strip() for c in columns if str(c).strip() and str(c).strip() in allowed}
    )
    selected_fields = _normalize_fields(config.get("fields", []), allowed)
    start_date, end_date, selected_codes = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=asset_values
    )

    api_fn = getattr(bs, API_NAME, None)
    if api_fn is None or not callable(api_fn):
        raise ValueError(f"baostock 未找到接口: {API_NAME}")

    if not selected_fields:
        selected_fields = list(default_fields)
    target_codes = _filter_minute_codes(
        resolve_target_codes(selected_codes, start_date=start_date),
        frequency,
    )
    effective_cols = sorted(
        {c for c in set(requested_cols) | set(selected_fields) | base_keys if c in allowed}
    )
    frames: list[pd.DataFrame] = []

    for code in tqdm(target_codes, desc="BaoStock 加载K线", unit="只"):
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


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "K线数据",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "columns_for_config": fields_for_frequency,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
