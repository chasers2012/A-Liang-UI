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
        Socket(
            "weights",
            required=True,
            value_type="dataframe",
            label="资产权重",
            description="因子权重或策略权重序列",
        ),
    ],
    workflow_parameters=[
        StringNodeParam(
            "period", required=False, default="1D", label="持有期", description="调仓与持仓计算周期"
        ),
        NodeParam(
            "freq",
            required=False,
            value_type="scalar_json",
            default=None,
            label="频率(可选)",
            description="可选 pandas offset/freq",
        ),
    ],
    output_sockets=[
        Socket(
            "positions",
            value_type="dataframe",
            label="持仓矩阵",
            description="按时间展开的资产持仓；格式：pd.DataFrame，index 为时间，columns 为资产代码，value 为仓位",
        ),
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
