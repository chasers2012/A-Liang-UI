from __future__ import annotations

import pandas as pd

from ..client import call_pro
from ._utils import extract_code_dates, select_columns

API_NAME = "stock_basic"
ASSET_COLUMN: str | None = "ts_code"
TIME_COLUMN: str = "list_date"

FIXED_COLUMNS = [
    "ts_code",
    "symbol",
    "name",
    "area",
    "industry",
    "fullname",
    "enname",
    "cnspell",
    "market",
    "exchange",
    "curr_type",
    "list_status",
    "list_date",
    "delist_date",
    "is_hs",
    "act_name",
    "act_ent_type",
]

LIST_STATUS_OPTIONS = ["L", "D", "P"]
LIST_STATUS_LABELS = ["上市", "退市", "暂停上市"]
LIST_STATUS_ONE_OF = [
    {"const": key, "title": label}
    for key, label in zip(LIST_STATUS_OPTIONS, LIST_STATUS_LABELS, strict=True)
]

json_schema = {
    "type": "object",
    "properties": {
        "list_status": {
            "type": "string",
            "title": "上市状态",
            "description": "L=上市 D=退市 P=暂停上市",
            "oneOf": LIST_STATUS_ONE_OF,
            "default": "L",
        },
        "exchange": {
            "type": "string",
            "title": "交易所",
            "description": "SSE=上交所 SZSE=深交所 BSE=北交所，留空表示全部",
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
    _ = date_column, asset_column
    token = str(config.get("token") or "")
    start_date, end_date, selected_codes = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=asset_values
    )
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or FIXED_COLUMNS
    fields = ",".join(effective_cols)
    df = call_pro(
        token,
        API_NAME,
        exchange=str(config.get("exchange") or ""),
        list_status=str(config.get("list_status") or "L"),
        fields=fields,
    )
    if selected_codes and not df.empty and "ts_code" in df.columns:
        code_set = set(selected_codes)
        df = df[df["ts_code"].astype(str).isin(code_set)]
    if not df.empty and TIME_COLUMN in df.columns:
        if start_date:
            df = df[df[TIME_COLUMN].astype(str) >= start_date]
        if end_date:
            df = df[df[TIME_COLUMN].astype(str) <= end_date]
    return select_columns(df, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "股票列表",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
