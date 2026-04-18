from __future__ import annotations

from typing import ClassVar

import pandas as pd
from factor.factor import Factor


class PriceFactor(Factor):
    """因子值等于面板中的收盘价 ``close``。"""

    name: ClassVar[str] = "price"
    label: ClassVar[str] = "价格(收盘)"
    dependencies: ClassVar[list[str]] = ["close"]
    max_window: ClassVar[int] = 1

    def calc(self, data: pd.DataFrame) -> pd.Series:
        return data["close"]
