from __future__ import annotations

from .query_adjust_factor import API_NAME as ADJUST_FACTOR_API
from .query_adjust_factor import FIXED_COLUMNS as adjust_factor_columns
from .query_adjust_factor import json_schema as adjust_factor_config
from .query_adjust_factor import load_frame as adjust_factor_loader
from .query_balance_data import API_NAME as BALANCE_API
from .query_balance_data import FIXED_COLUMNS as balance_columns
from .query_balance_data import json_schema as balance_config
from .query_balance_data import load_frame as balance_loader
from .query_cash_flow_data import API_NAME as CASH_FLOW_API
from .query_cash_flow_data import FIXED_COLUMNS as cash_flow_columns
from .query_cash_flow_data import json_schema as cash_flow_config
from .query_cash_flow_data import load_frame as cash_flow_loader
from .query_dividend_data import API_NAME as DIVIDEND_API
from .query_dividend_data import FIXED_COLUMNS as dividend_columns
from .query_dividend_data import json_schema as dividend_config
from .query_dividend_data import load_frame as dividend_loader
from .query_dupont_data import API_NAME as DUPONT_API
from .query_dupont_data import FIXED_COLUMNS as dupont_columns
from .query_dupont_data import json_schema as dupont_config
from .query_dupont_data import load_frame as dupont_loader
from .query_forecast_report import API_NAME as FORECAST_API
from .query_forecast_report import FIXED_COLUMNS as forecast_columns
from .query_forecast_report import json_schema as forecast_config
from .query_forecast_report import load_frame as forecast_loader
from .query_growth_data import API_NAME as GROWTH_API
from .query_growth_data import FIXED_COLUMNS as growth_columns
from .query_growth_data import json_schema as growth_config
from .query_growth_data import load_frame as growth_loader
from .query_history_k_data_plus import API_NAME as K_DATA_API
from .query_history_k_data_plus import FIXED_COLUMNS as k_data_columns
from .query_history_k_data_plus import json_schema as k_data_config
from .query_history_k_data_plus import load_frame as k_data_loader
from .query_hs300_stocks import API_NAME as HS300_API
from .query_hs300_stocks import FIXED_COLUMNS as hs300_columns
from .query_hs300_stocks import json_schema as hs300_config
from .query_hs300_stocks import load_frame as hs300_loader
from .query_operation_data import API_NAME as OPERATION_API
from .query_operation_data import FIXED_COLUMNS as operation_columns
from .query_operation_data import json_schema as operation_config
from .query_operation_data import load_frame as operation_loader
from .query_performance_express_report import API_NAME as PERFORMANCE_EXPRESS_API
from .query_performance_express_report import FIXED_COLUMNS as performance_express_columns
from .query_performance_express_report import json_schema as performance_express_config
from .query_performance_express_report import load_frame as performance_express_loader
from .query_profit_data import API_NAME as PROFIT_API
from .query_profit_data import FIXED_COLUMNS as profit_columns
from .query_profit_data import json_schema as profit_config
from .query_profit_data import load_frame as profit_loader
from .query_stock_basic import API_NAME as STOCK_BASIC_API
from .query_stock_basic import FIXED_COLUMNS as stock_basic_columns
from .query_stock_basic import json_schema as stock_basic_config
from .query_stock_basic import load_frame as stock_basic_loader
from .query_stock_industry import API_NAME as STOCK_INDUSTRY_API
from .query_stock_industry import FIXED_COLUMNS as stock_industry_columns
from .query_stock_industry import json_schema as stock_industry_config
from .query_stock_industry import load_frame as stock_industry_loader
from .query_sz50_stocks import API_NAME as SZ50_API
from .query_sz50_stocks import FIXED_COLUMNS as sz50_columns
from .query_sz50_stocks import json_schema as sz50_config
from .query_sz50_stocks import load_frame as sz50_loader
from .query_zz500_stocks import API_NAME as ZZ500_API
from .query_zz500_stocks import FIXED_COLUMNS as zz500_columns
from .query_zz500_stocks import json_schema as zz500_config
from .query_zz500_stocks import load_frame as zz500_loader

SUPPORTED_APIS = [
    {
        "key": K_DATA_API,
        "label": "K线数据",
        "loader": k_data_loader,
        "config": k_data_config,
        "columns": k_data_columns,
    },
    {
        "key": DIVIDEND_API,
        "label": "除权除息信息",
        "loader": dividend_loader,
        "config": dividend_config,
        "columns": dividend_columns,
    },
    {
        "key": ADJUST_FACTOR_API,
        "label": "复权因子",
        "loader": adjust_factor_loader,
        "config": adjust_factor_config,
        "columns": adjust_factor_columns,
    },
    {
        "key": PROFIT_API,
        "label": "季频盈利能力",
        "loader": profit_loader,
        "config": profit_config,
        "columns": profit_columns,
    },
    {
        "key": OPERATION_API,
        "label": "季频营运能力",
        "loader": operation_loader,
        "config": operation_config,
        "columns": operation_columns,
    },
    {
        "key": GROWTH_API,
        "label": "季频成长能力",
        "loader": growth_loader,
        "config": growth_config,
        "columns": growth_columns,
    },
    {
        "key": BALANCE_API,
        "label": "季频偿债能力",
        "loader": balance_loader,
        "config": balance_config,
        "columns": balance_columns,
    },
    {
        "key": CASH_FLOW_API,
        "label": "季频现金流量",
        "loader": cash_flow_loader,
        "config": cash_flow_config,
        "columns": cash_flow_columns,
    },
    {
        "key": DUPONT_API,
        "label": "季频杜邦指数",
        "loader": dupont_loader,
        "config": dupont_config,
        "columns": dupont_columns,
    },
    {
        "key": PERFORMANCE_EXPRESS_API,
        "label": "季频公司业绩快报",
        "loader": performance_express_loader,
        "config": performance_express_config,
        "columns": performance_express_columns,
    },
    {
        "key": FORECAST_API,
        "label": "季频公司业绩预告",
        "loader": forecast_loader,
        "config": forecast_config,
        "columns": forecast_columns,
    },
    {
        "key": STOCK_BASIC_API,
        "label": "证券基本资料",
        "loader": stock_basic_loader,
        "config": stock_basic_config,
        "columns": stock_basic_columns,
    },
    {
        "key": STOCK_INDUSTRY_API,
        "label": "证券行业信息",
        "loader": stock_industry_loader,
        "config": stock_industry_config,
        "columns": stock_industry_columns,
    },
    {
        "key": SZ50_API,
        "label": "上证50成分股",
        "loader": sz50_loader,
        "config": sz50_config,
        "columns": sz50_columns,
    },
    {
        "key": HS300_API,
        "label": "沪深300成分股",
        "loader": hs300_loader,
        "config": hs300_config,
        "columns": hs300_columns,
    },
    {
        "key": ZZ500_API,
        "label": "中证500成分股",
        "loader": zz500_loader,
        "config": zz500_config,
        "columns": zz500_columns,
    },
]
