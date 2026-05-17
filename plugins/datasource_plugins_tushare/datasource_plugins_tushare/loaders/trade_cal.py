from __future__ import annotations

import pandas as pd

from ..client import call_pro
from ._utils import extract_code_dates, select_columns

API_NAME = "trade_cal"
ASSET_COLUMN: str | None = None
TIME_COLUMN: str = "cal_date"

FIXED_COLUMNS = ["exchange", "cal_date", "is_open", "pretrade_date"]

EXCHANGE_OPTIONS = ["SSE", "SZSE", "BSE"]
EXCHANGE_LABELS = ["上交所", "深交所", "北交所"]
EXCHANGE_ONE_OF = [
    {"const": key, "title": label}
    for key, label in zip(EXCHANGE_OPTIONS, EXCHANGE_LABELS, strict=True)
]

json_schema = {
    "type": "object",
    "properties": {
        "exchange": {
            "type": "string",
            "title": "交易所",
            "oneOf": EXCHANGE_ONE_OF,
            "default": "SSE",
        },
        "is_open": {
            "type": "string",
            "title": "是否交易",
            "description": "0=休市 1=交易，留空表示全部",
            "enum": ["", "0", "1"],
            "default": "",
        },
    },
    "required": [],
}


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
    _ = date_column, asset_column, asset_values
    token = str(config.get("token") or "")
    start_date, end_date, _ = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=None
    )
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or FIXED_COLUMNS
    fields = ",".join(effective_cols)
    is_open = str(config.get("is_open") or "").strip()
    kwargs: dict = {
        "exchange": str(config.get("exchange") or "SSE"),
        "start_date": start_date,
        "end_date": end_date,
        "fields": fields,
    }
    if is_open in ("0", "1"):
        kwargs["is_open"] = is_open
    df = call_pro(token, API_NAME, **kwargs)
    return select_columns(df, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "交易日历",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
