from __future__ import annotations

from typing import cast

from .query_adjust_factor import LOADER_SPEC as adjust_factor_spec
from .query_balance_data import LOADER_SPEC as balance_spec
from .query_cash_flow_data import LOADER_SPEC as cash_flow_spec
from .query_dividend_data import LOADER_SPEC as dividend_spec
from .query_dupont_data import LOADER_SPEC as dupont_spec
from .query_forecast_report import LOADER_SPEC as forecast_spec
from .query_growth_data import LOADER_SPEC as growth_spec
from .query_history_k_data_plus import LOADER_SPEC as k_data_spec
from .query_hs300_stocks import LOADER_SPEC as hs300_spec
from .query_operation_data import LOADER_SPEC as operation_spec
from .query_performance_express_report import LOADER_SPEC as performance_express_spec
from .query_profit_data import LOADER_SPEC as profit_spec
from .query_stock_basic import LOADER_SPEC as stock_basic_spec
from .query_stock_industry import LOADER_SPEC as stock_industry_spec
from .query_sz50_stocks import LOADER_SPEC as sz50_spec
from .query_zz500_stocks import LOADER_SPEC as zz500_spec

SUPPORTED_APIS = [
    k_data_spec,
    dividend_spec,
    adjust_factor_spec,
    profit_spec,
    operation_spec,
    growth_spec,
    balance_spec,
    cash_flow_spec,
    dupont_spec,
    performance_express_spec,
    forecast_spec,
    stock_basic_spec,
    stock_industry_spec,
    sz50_spec,
    hs300_spec,
    zz500_spec,
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

DEFAULT_DATE_COLUMN: str = next(iter(API_DEFAULT_DATE_COLUMNS.values()), "date")
DEFAULT_ASSET_COLUMN: str | None = next(iter(API_DEFAULT_ASSET_COLUMNS.values()), "code")
if DEFAULT_ASSET_COLUMN is not None and not str(DEFAULT_ASSET_COLUMN).strip():
    DEFAULT_ASSET_COLUMN = None

DEFAULT_API_NAME: str = cast(str, SUPPORTED_APIS[0].get("key")) if SUPPORTED_APIS else ""
