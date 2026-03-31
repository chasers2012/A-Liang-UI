NEW_FACTOR_TEMPLATE = """from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class NewFactor(Factor):
    name = ""
    group = "custom"
    description = ""
    dependencies = ["close"]
    max_window = 2

    def calc(self, data: pd.DataFrame) -> pd.Series:
        close = data["close"]
        return close.groupby(level="asset", group_keys=False).pct_change(periods=1)
"""
