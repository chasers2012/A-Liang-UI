from __future__ import annotations

import pandas as pd
from tqdm import tqdm

from ..client import call_pro
from ._utils import extract_code_dates, resolve_target_codes, select_columns

API_NAME = "fina_indicator"
ASSET_COLUMN: str | None = "ts_code"
TIME_COLUMN: str = "end_date"

FIXED_COLUMNS = [
    "ts_code",
    "ann_date",
    "end_date",
    "eps",
    "dt_eps",
    "total_revenue_ps",
    "revenue_ps",
    "capital_rese_ps",
    "surplus_rese_ps",
    "undist_profit_ps",
    "extra_item",
    "profit_dedt",
    "gross_margin",
    "current_ratio",
    "quick_ratio",
    "cash_ratio",
    "roe",
    "roe_waa",
    "roe_dt",
    "roa",
    "npta",
    "roic",
    "debt_to_assets",
    "assets_to_eqt",
    "dp_assets_to_eqt",
    "ca_to_assets",
    "nca_to_assets",
    "tbassets_to_totalassets",
    "int_to_talcap",
    "eqt_to_talcapital",
    "currentdebt_to_debt",
    "longdeb_to_debt",
    "ocf_to_shortdebt",
    "debt_to_eqt",
    "eqt_to_debt",
    "eqt_to_interestdebt",
    "tangibleasset_to_debt",
    "tangasset_to_intdebt",
    "tangibleasset_to_netdebt",
    "ocf_to_debt",
    "turn_days",
    "roa_yearly",
    "roa_dp",
    "fixed_assets",
    "profit_to_op",
    "q_saleexp_to_gr",
    "q_gc_to_gr",
    "q_roe",
    "q_dt_roe",
    "q_npta",
    "q_ocf_to_sales",
    "basic_eps_yoy",
    "dt_eps_yoy",
    "cfps_yoy",
    "op_yoy",
    "ebt_yoy",
    "netprofit_yoy",
    "dt_netprofit_yoy",
    "ocf_yoy",
    "roe_yoy",
    "bps_yoy",
    "assets_yoy",
    "eqt_yoy",
    "tr_yoy",
    "or_yoy",
    "q_sales_yoy",
    "q_op_qoq",
    "equity_yoy",
]

json_schema = {"type": "object", "properties": {}, "required": []}


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
    _ = date_column, asset_column
    token = str(config.get("token") or "")
    start_date, end_date, selected_codes = extract_code_dates(
        start_date=start_date, end_date=end_date, asset_values=asset_values
    )
    requested_cols = sorted({str(c).strip() for c in columns if str(c).strip()})
    effective_cols = requested_cols or None
    fields = ",".join(effective_cols) if effective_cols else None
    target_codes = resolve_target_codes(token, selected_codes)
    frames: list[pd.DataFrame] = []

    for ts_code in tqdm(target_codes, desc="Tushare 财务指标", unit="只"):
        kwargs: dict = {"ts_code": ts_code}
        if start_date:
            kwargs["start_date"] = start_date
        if end_date:
            kwargs["end_date"] = end_date
        if fields:
            kwargs["fields"] = fields
        df = call_pro(token, API_NAME, **kwargs)
        if not df.empty:
            frames.append(df)

    if not frames:
        return pd.DataFrame(columns=effective_cols or [])
    out = pd.concat(frames, ignore_index=True)
    return select_columns(out, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "财务指标",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
