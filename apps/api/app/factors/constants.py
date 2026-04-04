NEW_FACTOR_TEMPLATE = """from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class NewFactor(Factor):
    name = ""
    group = "custom"
    description = ""
    dependencies = ["close"]
    max_window = 2 # max_window需要是calc中所使用的data最大窗口长度 + 1，例如使用20天的数据，需要将max_window设置为21

    def calc(self, data: pd.DataFrame) -> pd.Series:
        close = data["close"]
        return close.groupby(level="asset", group_keys=False).pct_change(periods=1)
"""
