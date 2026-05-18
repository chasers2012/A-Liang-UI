from __future__ import annotations

import pandas as pd

from ._utils import extract_code_dates, fetch_daily, select_columns

API_NAME = "daily"
ASSET_COLUMN: str | None = "ts_code"
TIME_COLUMN: str = "trade_date"

FIXED_COLUMNS = [
    "ts_code",
    "trade_date",
    "open",
    "high",
    "low",
    "close",
    "pre_close",
    "change",
    "pct_chg",
    "vol",
    "amount",
]

json_schema = {"type": "object", "properties": {}, "required": []}


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

    out = fetch_daily(
        token,
        selected_codes=selected_codes,
        start_date=start_date,
        end_date=end_date,
        fields=fields,
    )
    return select_columns(out, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "A股日线行情",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
