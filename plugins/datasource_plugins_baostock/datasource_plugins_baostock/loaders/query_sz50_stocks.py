from __future__ import annotations

import baostock as bs
import pandas as pd

from ._utils import extract_code_dates

API_NAME = "query_sz50_stocks"
FIXED_COLUMNS = ["date", "code", "code_name"]
json_schema = {
    "type": "object",
    "properties": {},
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
    start_date, _, _ = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=asset_values
    )
    rs = bs.query_sz50_stocks(date=start_date or "")
    if str(rs.error_code) != "0":
        raise ValueError(f"BaoStock 获取上证50成分股失败: {rs.error_msg}")
    return rs.get_data()
