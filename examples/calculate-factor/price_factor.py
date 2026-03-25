from __future__ import annotations

import pandas as pd
from factor.core import Factor


class PriceFactor(Factor):
    """因子值等于面板中的收盘价 ``close``。"""

    name = "price"
    label = "价格(收盘)"
    dependencies = ["close"]
    max_window = 1

    def calc(self, data: pd.DataFrame) -> pd.Series:
        return data["close"]
