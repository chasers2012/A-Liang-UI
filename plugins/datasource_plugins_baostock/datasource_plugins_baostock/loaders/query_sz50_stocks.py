from __future__ import annotations

import baostock as bs
import pandas as pd

from ._catalog import LoaderSpec
from ._utils import extract_code_dates


def load_frame(*, start_date: str | None = None) -> pd.DataFrame:
    start_date, _, _ = extract_code_dates(start_date=start_date, end_date=None, asset_values=None)
    rs = bs.query_sz50_stocks(date=start_date or "")
    if str(rs.error_code) != "0":
        raise ValueError(f"BaoStock 获取上证50成分股失败: {rs.error_msg}")
    return rs.get_data()


LOADER_SPEC = LoaderSpec(
    key="query_sz50_stocks",
    label="上证50成分股",
    loader=load_frame,
    config={"type": "object", "properties": {}, "required": []},
    columns=["date", "code", "code_name"],
    asset_column="code",
    date_column="date",
)
