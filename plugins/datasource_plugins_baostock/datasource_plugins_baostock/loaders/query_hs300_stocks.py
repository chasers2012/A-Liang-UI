from __future__ import annotations

import baostock as bs
import pandas as pd

from ._catalog import LoaderSpec
from ._utils import extract_code_dates


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
    rs = bs.query_hs300_stocks(date=start_date or "")
    if str(rs.error_code) != "0":
        raise ValueError(f"BaoStock 获取沪深300成分股信息失败: {rs.error_msg}")
    return rs.get_data()


LOADER_SPEC = LoaderSpec(
    key="query_hs300_stocks",
    label="沪深300成分股",
    loader=load_frame,
    config={"type": "object", "properties": {}, "required": []},
    columns=["date", "code", "code_name"],
    asset_column="code",
    date_column="date",
)
