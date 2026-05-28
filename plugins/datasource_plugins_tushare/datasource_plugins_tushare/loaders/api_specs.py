from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

FetchMode = Literal[
    "codes_and_range",  # ts_code(+逗号多码) + start_date + end_date
    "single_code_range",  # 单 ts_code + start_date + end_date
    "all_market_trade_date",  # 全市场单日：trade_date（daily / moneyflow）或 ts_code='' + trade_date（daily_basic）
]


@dataclass(frozen=True, slots=True)
class TushareApiSpec:
    api_name: str
    max_rows: int
    modes: frozenset[FetchMode]
    multi_ts_code_in_range: bool = False
    all_market_empty_ts_code: bool = False


# 参数定义以 https://tushare.pro/document/2 为准
API_SPECS: dict[str, TushareApiSpec] = {
    "daily": TushareApiSpec(
        api_name="daily",
        max_rows=6000,
        modes=frozenset({"codes_and_range", "all_market_trade_date"}),
        multi_ts_code_in_range=True,
    ),
    "daily_basic": TushareApiSpec(
        api_name="daily_basic",
        max_rows=6000,
        modes=frozenset({"single_code_range", "all_market_trade_date"}),
        all_market_empty_ts_code=True,
    ),
    "moneyflow": TushareApiSpec(
        api_name="moneyflow",
        max_rows=6000,
        modes=frozenset({"single_code_range", "all_market_trade_date"}),
    ),
    "index_daily": TushareApiSpec(
        api_name="index_daily",
        max_rows=8000,
        modes=frozenset({"single_code_range"}),
    ),
    "fina_indicator": TushareApiSpec(
        api_name="fina_indicator",
        max_rows=100,
        modes=frozenset({"single_code_range"}),
    ),
    "income": TushareApiSpec(
        api_name="income",
        max_rows=100,
        modes=frozenset({"single_code_range"}),
    ),
    "dividend": TushareApiSpec(
        api_name="dividend",
        max_rows=6000,
        modes=frozenset({"single_code_range"}),
    ),
}
