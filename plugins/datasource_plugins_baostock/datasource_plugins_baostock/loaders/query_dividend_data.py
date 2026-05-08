from __future__ import annotations

import baostock as bs
import pandas as pd

from ._utils import as_dataframe, extract_code_dates

API_NAME = "query_dividend_data"
FIXED_COLUMNS = [
    "code",
    "dividPreNoticeDate",
    "dividAgmPumDate",
    "dividPlanAnnounceDate",
    "dividPlanDate",
    "dividRegistDate",
    "dividOperateDate",
    "dividPayDate",
    "dividStockMarketDate",
    "dividCashPsBeforeTax",
    "dividCashPsAfterTax",
    "dividStocksPs",
    "dividCashStock",
    "dividReserveToStockPs",
]
json_schema = {
    "type": "object",
    "properties": {},
    "required": [],
}


def _infer_query_years(start_date: str | None, end_date: str | None) -> list[int | None]:
    if not start_date and not end_date:
        return [None]
    start_year = pd.Timestamp(start_date).year if start_date else None
    end_year = pd.Timestamp(end_date).year if end_date else None
    if start_year is None:
        return [end_year]
    if end_year is None:
        return [start_year]
    if start_year > end_year:
        start_year, end_year = end_year, start_year
    return list(range(start_year, end_year + 1))


def load_frame(*, columns: list[str], filters, config: dict) -> pd.DataFrame:
    start_date, end_date, selected_codes = extract_code_dates(filters)
    query_years = _infer_query_years(start_date, end_date)
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    frames: list[pd.DataFrame] = []
    target_codes = selected_codes or [""]
    for code in target_codes:
        for year in query_years:
            rs = bs.query_dividend_data(code=code, year=year, yearType="report")
            if str(rs.error_code) != "0":
                raise ValueError(f"BaoStock 查询除权除息信息失败({code}): {rs.error_msg}")
            df = as_dataframe(rs, columns=effective_cols)
            if not df.empty and "dividOperateDate" in df.columns:
                if start_date:
                    df = df[df["dividOperateDate"] >= start_date]
                if end_date:
                    df = df[df["dividOperateDate"] <= end_date]
            if not df.empty:
                frames.append(df)
    if frames:
        return pd.concat(frames, ignore_index=True)
    return pd.DataFrame(columns=effective_cols) if effective_cols else pd.DataFrame()
