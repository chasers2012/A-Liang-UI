from __future__ import annotations

import baostock as bs
import pandas as pd
from tqdm import tqdm

from ._utils import as_dataframe, extract_code_dates, resolve_target_codes

API_NAME = "query_forecast_report"
ASSET_COLUMN: str | None = "code"
TIME_COLUMN: str = "profitForcastExpPubDate"
FIXED_COLUMNS = [
    "code",
    "profitForcastExpPubDate",
    "profitForcastExpStatDate",
    "profitForcastType",
    "profitForcastAbstract",
    "profitForcastChgPctUp",
    "profitForcastChgPctDwn",
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
    start_date, end_date, selected_codes = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=asset_values
    )
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    target_codes = resolve_target_codes(selected_codes, start_date=start_date)
    for code in tqdm(target_codes, desc="BaoStock 业绩预告", unit="只"):
        rs = bs.query_forecast_report(code=code, start_date=start_date, end_date=end_date)
        if str(rs.error_code) != "0":
            raise ValueError(f"BaoStock 查询季频公司业绩预告失败({code}): {rs.error_msg}")
        df = as_dataframe(rs, columns=effective_cols)
        if not df.empty:
            frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "季频公司业绩预告",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
