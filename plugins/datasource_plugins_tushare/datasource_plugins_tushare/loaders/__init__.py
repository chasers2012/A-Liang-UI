from __future__ import annotations

from typing import cast

from .daily import LOADER_SPEC as daily_spec
from .daily_basic import LOADER_SPEC as daily_basic_spec
from .dividend import LOADER_SPEC as dividend_spec
from .fina_indicator import LOADER_SPEC as fina_indicator_spec
from .income import LOADER_SPEC as income_spec
from .index_daily import LOADER_SPEC as index_daily_spec
from .index_weight import LOADER_SPEC as index_weight_spec
from .moneyflow import LOADER_SPEC as moneyflow_spec
from .stock_basic import LOADER_SPEC as stock_basic_spec
from .trade_cal import LOADER_SPEC as trade_cal_spec

SUPPORTED_APIS = [
    daily_spec,
    daily_basic_spec,
    stock_basic_spec,
    trade_cal_spec,
    index_daily_spec,
    index_weight_spec,
    fina_indicator_spec,
    income_spec,
    moneyflow_spec,
    dividend_spec,
]

API_DEFAULT_DATE_COLUMNS = {
    str(api.get("key")): str(api.get("date_column")) for api in SUPPORTED_APIS if api.get("key")
}

API_DEFAULT_ASSET_COLUMNS = {
    str(api.get("key")): (
        str(api.get("asset_column")).strip() if api.get("asset_column") is not None else None
    )
    for api in SUPPORTED_APIS
    if api.get("key")
}

DEFAULT_DATE_COLUMN: str = next(iter(API_DEFAULT_DATE_COLUMNS.values()), "trade_date")
DEFAULT_ASSET_COLUMN: str | None = next(iter(API_DEFAULT_ASSET_COLUMNS.values()), "ts_code")
if DEFAULT_ASSET_COLUMN is not None and not str(DEFAULT_ASSET_COLUMN).strip():
    DEFAULT_ASSET_COLUMN = None

DEFAULT_API_NAME: str = cast(str, SUPPORTED_APIS[0].get("key")) if SUPPORTED_APIS else ""
