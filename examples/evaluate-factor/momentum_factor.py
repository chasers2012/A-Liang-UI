from __future__ import annotations

from typing import ClassVar

import pandas as pd
from factor.factor import Factor


class MomentumFactor(Factor):
    """过去 ``lookback`` 个交易日收益率 close_t / close_{t-lookback} - 1。"""

    name: ClassVar[str] = "mom_10d"
    label: ClassVar[str] = "10日动量"
    dependencies: ClassVar[list[str]] = ["close"]
    max_window: ClassVar[int] = 11
    lookback: ClassVar[int] = 10

    def calc(self, data: pd.DataFrame) -> pd.Series:
        close = data["close"]
        return close.groupby(level="asset", group_keys=False).pct_change(periods=self.lookback)
