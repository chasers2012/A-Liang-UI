# builtin metric: mean return spread (seeded template)
from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import MeanReturnSpreadMetric
from workflow import workflow_node, workflow_socket


@workflow_node(
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[workflow_socket("mean_return_spread", value_type="scalar_json")],
    entry="evaluate",
)
class BuiltinMeanReturnSpreadMetric(MeanReturnSpreadMetric):
    """分位多空平均收益差（按持有期）。"""

    def evaluate(
        self,
        factor_data_clean: pd.DataFrame,
        *,
        quantiles: int,
        **kwargs: Any,
    ) -> tuple[pd.Series]:
        _ = kwargs
        return (super().evaluate(factor_data_clean, quantiles=quantiles),)
