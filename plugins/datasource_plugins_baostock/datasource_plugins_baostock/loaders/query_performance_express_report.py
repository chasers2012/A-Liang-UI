from __future__ import annotations

import baostock as bs
import pandas as pd

from ._utils import as_dataframe, extract_code_dates

API_NAME = "query_performance_express_report"
FIXED_COLUMNS = [
    "code",
    "performanceExpPubDate",
    "performanceExpStatDate",
    "performanceExpUpdateDate",
    "performanceExpressTotalAsset",
    "performanceExpressNetAsset",
    "performanceExpressEPSChwa",
    "performanceExpressROEWa",
    "performanceExpressYoyNI",
    "performanceExpressYoyEPSBasic",
]
json_schema = {"type": "object", "properties": {}, "required": []}


def load_frame(*, columns: list[str], filters, config: dict) -> pd.DataFrame:
    start_date, end_date, selected_codes = extract_code_dates(filters)
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    for code in selected_codes or [""]:
        rs = bs.query_performance_express_report(
            code=code, start_date=start_date, end_date=end_date
        )
        if str(rs.error_code) != "0":
            raise ValueError(f"BaoStock 查询季频公司业绩快报失败({code}): {rs.error_msg}")
        df = as_dataframe(rs, columns=effective_cols)
        if not df.empty:
            frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()
