from __future__ import annotations

import pandas as pd
from factor import Factor


class Momentum10dFactor(Factor):
    name = "10日动量因子"
    group = "example"
    description = "10-day close-to-close momentum."
    param_specs = ({"name": "lookback", "label": "Lookback", "default": 10, "min": 2, "max": 120},)

    @property
    def window(self) -> int:
        return int(self.params["lookback"] + 1)

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        lookback = int(self.params["lookback"])
        return close.pct_change(periods=lookback)


class ShortTermReversalFactor(Factor):
    name = "5日反转因子"
    group = "example"
    description = "Negative 5-day return as short-term reversal signal."
    param_specs = ({"name": "lookback", "label": "Lookback", "default": 5, "min": 2, "max": 60},)

    @property
    def window(self) -> int:
        return int(self.params["lookback"] + 1)

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        lookback = int(self.params["lookback"])
        return -close.pct_change(periods=lookback)


class LowVolatilityFactor(Factor):
    name = "20日低波动因子"
    group = "example"
    description = "Negative rolling volatility of 1-day returns."
    param_specs = ({"name": "window", "label": "Window", "default": 20, "min": 5, "max": 120},)

    @property
    def window(self) -> int:
        return int(self.params["window"] + 1)

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        rolling_window = int(self.params["window"])
        returns = close.pct_change()
        return -returns.rolling(rolling_window).std()


__all__ = [
    "LowVolatilityFactor",
    "Momentum10dFactor",
    "ShortTermReversalFactor",
]
