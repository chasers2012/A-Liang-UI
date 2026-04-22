NEW_FACTOR_TEMPLATE = """from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class NewFactor(Factor):
    name = ""
    group = "custom"
    description = ""
    window = 2 # window 需要是 calc 中所使用的 data 最大窗口长度

    def calc(self, close: pd.DataFrame) -> pd.DataFrame:
        return close.pct_change(periods=1)
"""
