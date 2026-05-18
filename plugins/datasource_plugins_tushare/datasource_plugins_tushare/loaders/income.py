from __future__ import annotations

import pandas as pd

from ._utils import extract_code_dates, load_by_ts_code_series, resolve_target_codes, select_columns

API_NAME = "income"
ASSET_COLUMN: str | None = "ts_code"
TIME_COLUMN: str = "end_date"

FIXED_COLUMNS = [
    "ts_code",
    "ann_date",
    "f_ann_date",
    "end_date",
    "report_type",
    "comp_type",
    "end_type",
    "basic_eps",
    "diluted_eps",
    "total_revenue",
    "revenue",
    "int_income",
    "prem_earned",
    "comm_income",
    "n_commis_income",
    "n_oth_income",
    "n_oth_b_income",
    "prem_income",
    "out_prem",
    "une_prem_reser",
    "reins_income",
    "n_sec_tb_income",
    "n_sec_uw_income",
    "n_asset_mg_income",
    "oth_b_income",
    "fv_value_chg_gain",
    "invest_income",
    "ass_invest_income",
    "forex_gain",
    "total_cogs",
    "oper_cost",
    "int_exp",
    "comm_exp",
    "biz_tax_surchg",
    "sell_exp",
    "admin_exp",
    "fin_exp",
    "assets_impair_loss",
    "prem_refund",
    "compens_payout",
    "reser_insur_liab",
    "div_payt",
    "reins_exp",
    "oper_exp",
    "compens_payout_refu",
    "insur_reser_refu",
    "reins_cost_refund",
    "other_bus_cost",
    "operate_profit",
    "non_oper_income",
    "non_oper_exp",
    "nca_disploss",
    "total_profit",
    "income_tax",
    "n_income",
    "n_income_attr_p",
    "minority_gain",
    "oth_compr_income",
    "t_compr_income",
    "compr_inc_attr_p",
    "compr_inc_attr_m_s",
    "ebit",
    "ebitda",
    "insurance_exp",
    "undist_profit",
    "distable_profit",
    "rd_exp",
    "fin_exp_int_exp",
    "fin_exp_int_inc",
    "transfer_surplus_rese",
    "transfer_housing_imprest",
    "transfer_oth",
    "adj_lossgain",
    "withdra_legal_surplus",
    "withdra_legal_pubfund",
    "withdra_biz_devfund",
    "withdra_rese_fund",
    "withdra_oth_ersu",
    "workers_welfare",
    "distr_profit_shrhder",
    "prfshare_payable_dvd",
    "compr_inc_attr_m_s",
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
    if not target_codes:
        return pd.DataFrame(columns=effective_cols or [])

    def build_kwargs(ts_code: str) -> dict:
        kwargs: dict = {"ts_code": ts_code}
        if start_date:
            kwargs["start_date"] = start_date
        if end_date:
            kwargs["end_date"] = end_date
        if fields:
            kwargs["fields"] = fields
        return kwargs

    out = load_by_ts_code_series(
        token,
        API_NAME,
        target_codes,
        build_kwargs=build_kwargs,
    )
    return select_columns(out, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "利润表",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
