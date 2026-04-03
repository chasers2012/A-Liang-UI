"""Built-in workflow node: compute mean returns spread (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Mean Return Spread",
    description="计算高/低分位的均值收益差（Alphalens.performance.compute_mean_returns_spread）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("mean_returns", required=True, value_type="dataframe"),
        Socket("std_err", required=False, value_type="dataframe"),
    ],
    workflow_parameters=[
        NumberNodeParam("upper_quant", required=False, default=5),
        NumberNodeParam("lower_quant", required=False, default=1),
    ],
    output_sockets=[
        Socket("mean_return_spread", value_type="scalar_json"),
        Socket("mean_return_spread_std_error", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class ComputeMeanReturnsSpreadMetric(EvaluationMetric):
    def evaluate(
        self,
        mean_returns: pd.DataFrame,
        std_err: pd.DataFrame | None = None,
        *,
        upper_quant: int = 5,
        lower_quant: int = 1,
        **kwargs: Any,
    ) -> tuple[pd.Series, pd.Series | None]:
        import alphalens as al

        _ = kwargs
        return al.performance.compute_mean_returns_spread(
            mean_returns,
            upper_quant=upper_quant,
            lower_quant=lower_quant,
            std_err=std_err,
        )
