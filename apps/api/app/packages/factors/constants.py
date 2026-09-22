NEW_FACTOR_TEMPLATE = """from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class NewFactor(Factor):
    name = ""
    group = "custom"
    description = ""
    param_specs = ({"name": "lookback", "label": "回看周期", "default": 1, "min": 1, "max": 250},)

    @property
    def window(self) -> int:
        return int(self.params["lookback"])  # window 需要是 calc 中所使用的 data 最大窗口长度

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        lookback = int(self.params["lookback"])
        return close.pct_change(periods=lookback)
"""
