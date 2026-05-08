from __future__ import annotations

import baostock as bs
import pandas as pd

from ._utils import as_dataframe, extract_code_dates, quarter_range

API_NAME = "query_profit_data"
FIXED_COLUMNS = [
    "code",
    "pubDate",
    "statDate",
    "roeAvg",
    "npMargin",
    "gpMargin",
    "netProfit",
    "epsTTM",
    "MBRevenue",
    "totalShare",
    "liqaShare",
]
json_schema = {
    "type": "object",
    "properties": {},
    "required": [],
}


def load_frame(*, columns: list[str], filters, config: dict) -> pd.DataFrame:
    _, _, selected_codes = extract_code_dates(filters)
    start_date, end_date, _ = extract_code_dates(filters)
    quarters = quarter_range(start_date, end_date)
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    target_codes = selected_codes or [""]
    for code in target_codes:
        if quarters:
            for year, quarter in quarters:
                rs = bs.query_profit_data(code=code, year=year, quarter=quarter)
                if str(rs.error_code) != "0":
                    raise ValueError(
                        f"BaoStock 查询季频盈利能力失败({code}, {year}Q{quarter}): {rs.error_msg}"
                    )
                df = as_dataframe(rs, columns=effective_cols)
                if not df.empty:
                    frames.append(df)
        else:
            rs = bs.query_profit_data(code=code, year=None, quarter=None)
            if str(rs.error_code) != "0":
                raise ValueError(f"BaoStock 查询季频盈利能力失败({code}): {rs.error_msg}")
            df = as_dataframe(rs, columns=effective_cols)
            if not df.empty:
                frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()
