from __future__ import annotations

import baostock as bs
import pandas as pd

from ._catalog import LoaderSpec
from ._utils import as_dataframe


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
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    rs = bs.query_stock_industry()
    if str(rs.error_code) != "0":
        raise ValueError(f"BaoStock 查询证券行业信息失败: {rs.error_msg}")
    df = as_dataframe(rs, columns=effective_cols)
    if not df.empty:
        frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()


LOADER_SPEC = LoaderSpec(
    key="query_stock_industry",
    label="证券行业信息",
    loader=load_frame,
    config={"type": "object", "properties": {}, "required": []},
    columns=["date", "code", "code_name", "industry", "industryClassification"],
    asset_column="code",
    date_column="date",
)
