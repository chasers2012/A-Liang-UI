from __future__ import annotations

import pandas as pd

from ..client import call_pro
from ._utils import extract_code_dates, merge_frames, select_columns, to_ts_code

API_NAME = "index_daily"
ASSET_COLUMN: str | None = "ts_code"
TIME_COLUMN: str = "trade_date"

FIXED_COLUMNS = [
    "ts_code",
    "trade_date",
    "close",
    "open",
    "high",
    "low",
    "pre_close",
    "change",
    "pct_chg",
    "vol",
    "amount",
]

INDEX_OPTIONS = [
    ("000001.SH", "上证综指"),
    ("399001.SZ", "深证成指"),
    ("000016.SH", "上证50"),
    ("000300.SH", "沪深300"),
    ("000905.SH", "中证500"),
    ("399006.SZ", "创业板指"),
]
INDEX_ONE_OF = [{"const": code, "title": label} for code, label in INDEX_OPTIONS]

json_schema = {
    "type": "object",
    "properties": {
        "ts_code": {
            "type": "string",
            "title": "指数代码",
            "description": "未在数据集中指定资产时使用的默认指数",
            "oneOf": INDEX_ONE_OF,
            "default": "000300.SH",
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
    _ = date_column, asset_column
    token = str(config.get("token") or "")
    start_date, end_date, selected_codes = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=asset_values
    )
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or FIXED_COLUMNS
    fields = ",".join(effective_cols)
    default_code = to_ts_code(str(config.get("ts_code") or "000300.SH"))
    target_codes = selected_codes or [default_code]

    frames: list[pd.DataFrame] = []
    for ts_code in target_codes:
        df = call_pro(
            token,
            API_NAME,
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields=fields,
        )
        if not df.empty:
            frames.append(df)

    out = merge_frames(frames, columns=effective_cols)
    return select_columns(out, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "指数日线行情",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
