from __future__ import annotations

from . import (
    query_adjust_factor,
    query_balance_data,
    query_cash_flow_data,
    query_dividend_data,
    query_dupont_data,
    query_forecast_report,
    query_growth_data,
    query_history_k_data_daily,
    query_history_k_data_minute,
    query_history_k_data_weekly_monthly,
    query_hs300_stocks,
    query_operation_data,
    query_performance_express_report,
    query_profit_data,
    query_stock_basic,
    query_stock_industry,
    query_sz50_stocks,
    query_zz500_stocks,
)
from ._catalog import ApiCatalog, LoaderSpec, build_api_catalog

_SUPPORTED_APIS: tuple[LoaderSpec, ...] = (
    query_history_k_data_daily.LOADER_SPEC,
    query_history_k_data_weekly_monthly.LOADER_SPEC,
    query_history_k_data_minute.LOADER_SPEC,
    query_dividend_data.LOADER_SPEC,
    query_adjust_factor.LOADER_SPEC,
    query_profit_data.LOADER_SPEC,
    query_operation_data.LOADER_SPEC,
    query_growth_data.LOADER_SPEC,
    query_balance_data.LOADER_SPEC,
    query_cash_flow_data.LOADER_SPEC,
    query_dupont_data.LOADER_SPEC,
    query_performance_express_report.LOADER_SPEC,
    query_forecast_report.LOADER_SPEC,
    query_stock_basic.LOADER_SPEC,
    query_stock_industry.LOADER_SPEC,
    query_sz50_stocks.LOADER_SPEC,
    query_hs300_stocks.LOADER_SPEC,
    query_zz500_stocks.LOADER_SPEC,
)

API_CATALOG: ApiCatalog = build_api_catalog(_SUPPORTED_APIS)
