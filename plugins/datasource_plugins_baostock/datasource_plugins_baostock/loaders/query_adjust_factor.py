from __future__ import annotations

import baostock as bs
import pandas as pd

from ._utils import as_dataframe, extract_code_dates

API_NAME = "query_adjust_factor"
FIXED_COLUMNS = ["code", "dividOperateDate", "foreAdjustFactor", "backAdjustFactor", "adjustFactor"]
json_schema = {
    "type": "object",
    "properties": {},
    "required": [],
}


def load_frame(*, columns: list[str], filters, config: dict) -> pd.DataFrame:
    start_date, end_date, selected_codes = extract_code_dates(filters)
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    target_codes = selected_codes or [""]
    for code in target_codes:
        rs = bs.query_adjust_factor(code=code, start_date=start_date, end_date=end_date)
        if str(rs.error_code) != "0":
            raise ValueError(f"BaoStock 查询复权因子失败({code}): {rs.error_msg}")
        df = as_dataframe(rs, columns=effective_cols)
        if not df.empty:
            frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()
