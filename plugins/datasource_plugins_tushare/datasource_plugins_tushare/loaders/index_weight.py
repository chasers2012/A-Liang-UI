from __future__ import annotations

import pandas as pd

from ..client import call_pro
from ._utils import extract_code_dates, select_columns, to_ts_code

API_NAME = "index_weight"
ASSET_COLUMN: str | None = "con_code"
TIME_COLUMN: str = "trade_date"

FIXED_COLUMNS = ["index_code", "con_code", "trade_date", "weight"]

INDEX_OPTIONS = [
    ("000016.SH", "上证50"),
    ("000300.SH", "沪深300"),
    ("000905.SH", "中证500"),
    ("399006.SZ", "创业板指"),
]
INDEX_ONE_OF = [{"const": code, "title": label} for code, label in INDEX_OPTIONS]

json_schema = {
    "type": "object",
    "properties": {
        "index_code": {
            "type": "string",
            "title": "指数代码",
            "oneOf": INDEX_ONE_OF,
            "default": "000016.SH",
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
    index_code = to_ts_code(str(config.get("index_code") or "000016.SH"))
    df = call_pro(
        token,
        API_NAME,
        index_code=index_code,
        start_date=start_date,
        end_date=end_date,
        fields=fields,
    )
    return select_columns(df, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "指数成分和权重",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
