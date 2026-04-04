"""Built-in workflow node: quantile turnover (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Quantile Turnover",
    description="计算分位桶的换手率/流动性（Alphalens.performance.quantile_turnover）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
        Socket("quantile_factor", required=False, value_type="dataframe"),
    ],
    workflow_parameters=[
        NumberNodeParam("quantile", required=False, default=5),
        NumberNodeParam("period", required=False, default=1),
    ],
    output_sockets=[
        Socket("quantile_turnover", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class QuantileTurnoverMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        quantile_factor: pd.Series | None = None,
        *,
        quantile: int = 5,
        period: int = 1,
        **kwargs: Any,
    ) -> pd.Series:
        import alphalens as al

        _ = kwargs
        qf = quantile_factor if quantile_factor is not None else clean_factor["factor_quantile"]
        return al.performance.quantile_turnover(qf, quantile=quantile, period=period)
