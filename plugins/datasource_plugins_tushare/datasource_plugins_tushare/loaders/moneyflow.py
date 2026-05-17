from __future__ import annotations

import pandas as pd
from tqdm import tqdm

from ..client import call_pro
from ._utils import extract_code_dates, resolve_target_codes, select_columns

API_NAME = "moneyflow"
ASSET_COLUMN: str | None = "ts_code"
TIME_COLUMN: str = "trade_date"

FIXED_COLUMNS = [
    "ts_code",
    "trade_date",
    "buy_sm_vol",
    "buy_sm_amount",
    "sell_sm_vol",
    "sell_sm_amount",
    "buy_md_vol",
    "buy_md_amount",
    "sell_md_vol",
    "sell_md_amount",
    "buy_lg_vol",
    "buy_lg_amount",
    "sell_lg_vol",
    "sell_lg_amount",
    "buy_elg_vol",
    "buy_elg_amount",
    "sell_elg_vol",
    "sell_elg_amount",
    "net_mf_vol",
    "net_mf_amount",
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
    effective_cols = requested_cols or FIXED_COLUMNS
    fields = ",".join(effective_cols)
    target_codes = resolve_target_codes(token, selected_codes)
    frames: list[pd.DataFrame] = []

    for ts_code in tqdm(target_codes, desc="Tushare 资金流向", unit="只"):
        df = call_pro(
            token,
            API_NAME,
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields=fields,
        )
        if not df.empty:
            frames.append(df)

    if not frames:
        return pd.DataFrame(columns=effective_cols)
    out = pd.concat(frames, ignore_index=True)
    return select_columns(out, requested_cols or None)


LOADER_SPEC: dict[str, object] = {
    "key": API_NAME,
    "label": "个股资金流向",
    "loader": load_frame,
    "config": json_schema,
    "columns": FIXED_COLUMNS,
    "asset_column": ASSET_COLUMN,
    "date_column": TIME_COLUMN,
}
