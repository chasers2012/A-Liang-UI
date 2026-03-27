# builtin metric: mean IC (seeded template)
from __future__ import annotations

from typing import Any, ClassVar

import pandas as pd
from evaluate import MeanInformationCoefficientMetric


class BuiltinMeanICMetric(MeanInformationCoefficientMetric):
    """各持有期平均信息系数（Alphalens）。"""

    SNAPSHOT_FIELD: ClassVar[str] = "mean_ic"
    INPUT_SOCKETS: ClassVar[list[dict[str, object]]] = [
        {"name": "clean_factor", "required": True, "value_type": "factor_data_clean"},
    ]
    OUTPUT_SOCKETS: ClassVar[list[dict[str, object]]] = [
        {"name": "mean_ic", "value_type": "scalar_json"},
    ]
    VISUALIZATION: ClassVar[dict[str, object]] = {"mode": "auto", "period_day_keys": True}

    def evaluate(self, factor_data_clean: pd.DataFrame, **kwargs: Any) -> pd.Series | pd.DataFrame:
        _ = kwargs
        return super().evaluate(factor_data_clean)
