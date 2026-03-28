# builtin metric: mean return spread (seeded template)
from __future__ import annotations

from typing import Any, ClassVar

import pandas as pd
from evaluate import MeanReturnSpreadMetric


class BuiltinMeanReturnSpreadMetric(MeanReturnSpreadMetric):
    """分位多空平均收益差（按持有期）。"""

    SNAPSHOT_FIELD: ClassVar[str] = "mean_return_spread"
    INPUT_SOCKETS: ClassVar[list[dict[str, object]]] = [
        {"name": "clean_factor", "required": True, "value_type": "factor_data_clean"},
    ]
    OUTPUT_SOCKETS: ClassVar[list[dict[str, object]]] = [
        {"name": "mean_return_spread", "value_type": "scalar_json"},
    ]
    VISUALIZATION: ClassVar[dict[str, object]] = {"mode": "auto", "period_day_keys": False}

    def evaluate(
        self,
        factor_data_clean: pd.DataFrame,
        *,
        quantiles: int,
        **kwargs: Any,
    ) -> pd.Series:
        _ = kwargs
        return super().evaluate(factor_data_clean, quantiles=quantiles)
