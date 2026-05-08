from __future__ import annotations

import baostock as bs
import pandas as pd
from tqdm import tqdm

from ._utils import as_dataframe, extract_code_dates, resolve_target_codes

API_NAME = "query_stock_basic"
FIXED_COLUMNS = ["code", "code_name", "ipoDate", "outDate", "type", "status"]
json_schema = {"type": "object", "properties": {}, "required": []}


def load_frame(*, columns: list[str], filters, config: dict) -> pd.DataFrame:
    start_date, _, selected_codes = extract_code_dates(filters)
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    target_codes = resolve_target_codes(selected_codes, start_date=start_date)
    for code in tqdm(target_codes, desc="BaoStock 证券资料", unit="只"):
        rs = bs.query_stock_basic(code=code, code_name="")
        if str(rs.error_code) != "0":
            raise ValueError(f"BaoStock 查询证券基本资料失败({code}): {rs.error_msg}")
        df = as_dataframe(rs, columns=effective_cols)
        if not df.empty:
            frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()
