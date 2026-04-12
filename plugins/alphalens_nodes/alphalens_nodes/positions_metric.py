"""Built-in workflow node: positions (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Positions",
    description="根据权重序列构建持仓时间序列，基于调仓时点权重与持有期生成各时点资产仓位占比。",
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
            "period",
            required=False,
            default="1D",
            label="持有期",
            description="持有周期（如 1D、5D）",
        ),
        NodeParam(
            "freq",
            required=False,
            value_type="scalar_json",
            default=None,
            label="频率(可选)",
            description="可选重采样频率（pandas offset/freq）",
        ),
    ],
    output_sockets=[
        Socket(
            "positions",
            value_type="dataframe",
            label="持仓矩阵",
            description="按时间展开的资产持仓\n\n**数据格式**\n- pd.DataFrame，index 为时间，columns 为资产代码，value 为仓位",
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
