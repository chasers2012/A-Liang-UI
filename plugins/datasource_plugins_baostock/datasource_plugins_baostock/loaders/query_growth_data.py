from __future__ import annotations

import baostock as bs
import pandas as pd
from tqdm import tqdm

from ._catalog import LoaderSpec
from ._utils import as_dataframe, extract_code_dates, quarter_range, resolve_target_codes


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
    quarters = quarter_range(start_date, end_date)
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    target_codes = resolve_target_codes(selected_codes, start_date=start_date)
    for code in tqdm(target_codes, desc="BaoStock 成长能力", unit="只"):
        for year, quarter in quarters or [(None, None)]:
            rs = bs.query_growth_data(code=code, year=year, quarter=quarter)
            if str(rs.error_code) != "0":
                raise ValueError(
                    f"BaoStock 查询季频成长能力失败({code}, {year}Q{quarter}): {rs.error_msg}"
                )
            df = as_dataframe(rs, columns=effective_cols)
            if not df.empty:
                frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()


LOADER_SPEC = LoaderSpec(
    key="query_growth_data",
    label="季频成长能力",
    loader=load_frame,
    config={"type": "object", "properties": {}, "required": []},
    columns=[
        "code",
        "pubDate",
        "statDate",
        "YOYEquity",
        "YOYAsset",
        "YOYNI",
        "YOYEPSBasic",
        "YOYPNI",
    ],
    asset_column="code",
    date_column="pubDate",
)
