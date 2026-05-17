from __future__ import annotations

import pandas as pd
from tqdm import tqdm

from ..client import call_pro
from ._utils import extract_code_dates, resolve_target_codes, select_columns

API_NAME = "dividend"
ASSET_COLUMN: str | None = "ts_code"
TIME_COLUMN: str = "ex_date"

FIXED_COLUMNS = [
    "ts_code",
    "end_date",
    "ann_date",
    "div_proc",
    "stk_div",
    "stk_bo_rate",
    "stk_co_rate",
    "cash_div",
    "cash_div_tax",
    "record_date",
    "ex_date",
    "pay_date",
    "div_listdate",
    "imp_ann_date",
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
    target_codes = resolve_target_codes(token, selected_codes)
    frames: list[pd.DataFrame] = []

    for ts_code in tqdm(target_codes, desc="Tushare 分红送股", unit="只"):
        kwargs: dict = {"ts_code": ts_code, "fields": fields}
        if start_date:
            kwargs["ann_date"] = start_date
        df = call_pro(token, API_NAME, **kwargs)
        if not df.empty and TIME_COLUMN in df.columns:
            if start_date:
                df = df[df[TIME_COLUMN].astype(str) >= start_date]
            if end_date:
                df = df[df[TIME_COLUMN].astype(str) <= end_date]
        if not df.empty:
            frames.append(df)

    if not frames:
        return pd.DataFrame(columns=effective_cols)
    out = pd.concat(frames, ignore_index=True)
    return select_columns(out, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "分红送股",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
