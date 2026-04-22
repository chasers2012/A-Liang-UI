from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class MomentumFactor(Factor):
    """过去 ``lookback`` 个交易日收益率 close_t / close_{t-lookback} - 1。"""

    name = "mom_10d"
    label = "10日动量"
    max_window = 11
    lookback = 10

    def calc(self, close: pd.DataFrame) -> pd.Series:
        return close.pct_change(periods=self.lookback).stack()
