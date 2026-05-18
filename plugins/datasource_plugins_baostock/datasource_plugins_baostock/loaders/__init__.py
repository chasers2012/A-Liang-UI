from __future__ import annotations

from ._catalog import ApiCatalog, build_api_catalog
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

_SUPPORTED_APIS = [
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

API_CATALOG: ApiCatalog = build_api_catalog(_SUPPORTED_APIS)
