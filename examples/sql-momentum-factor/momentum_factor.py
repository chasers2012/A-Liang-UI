from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class MomentumFactor(Factor):
    """过去 ``lookback`` 个交易日收益率 close_t / close_{t-lookback} - 1。"""

    name = "mom_10d"
    label = "10日动量"
    lookback = 10
    param_specs = ({"name": "lookback", "label": "回看周期", "default": 10, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.lookback + 1)

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return close.pct_change(periods=int(self.lookback))
