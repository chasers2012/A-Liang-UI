"""Built-in workflow node: positions (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Positions",
    description="根据权重序列构建持仓/仓位时间序列（Alphalens.performance.positions）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("weights", required=True, value_type="dataframe"),
    ],
    workflow_parameters=[
        StringNodeParam("period", required=False, default="1D"),
        NodeParam("freq", required=False, value_type="scalar_json", default=None),
    ],
    output_sockets=[
        Socket("positions", value_type="dataframe"),
    ],
    entry="evaluate",
)
class PositionsMetric(EvaluationMetric):
    def evaluate(
        self,
        weights: pd.Series,
        *,
        period: str = "1D",
        freq: Any = None,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.positions(weights, period, freq=freq)
