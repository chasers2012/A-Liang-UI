from __future__ import annotations

import baostock as bs
import pandas as pd
from tqdm import tqdm

from ._catalog import LoaderSpec
from ._utils import as_dataframe, extract_code_dates, resolve_target_codes


def load_frame(
    *,
    columns: list[str],
    start_date: str | None = None,
    end_date: str | None = None,
    asset_values: list[str] | None = None,
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


LOADER_SPEC = LoaderSpec(
    key="query_forecast_report",
    label="季频公司业绩预告",
    loader=load_frame,
    config={"type": "object", "properties": {}, "required": []},
    columns=[
        "code",
        "profitForcastExpPubDate",
        "profitForcastExpStatDate",
        "profitForcastType",
        "profitForcastAbstract",
        "profitForcastChgPctUp",
        "profitForcastChgPctDwn",
    ],
    asset_column="code",
    date_column="profitForcastExpPubDate",
)
