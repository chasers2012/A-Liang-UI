"""Built-in workflow node: cumulative returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import Socket, workflow_node


@workflow_node(
    label="Cumulative Returns",
    description="将简单收益序列累积化（Alphalens.performance.cumulative_returns）",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "returns",
            required=True,
            value_type="scalar_json",
            label="收益序列",
            description="简单收益率序列",
        ),
    ],
    output_sockets=[
        Socket(
            "cumulative_returns",
            value_type="scalar_json",
            label="累计收益序列",
            description="累计化后的收益序列；格式：JSON 可序列化时间序列（dict[datetime, number]）",
        ),
    ],
    entry="evaluate",
)
class CumulativeReturnsMetric(EvaluationMetric):
    def evaluate(self, returns: pd.Series, **kwargs: Any) -> pd.Series:
        import alphalens as al

        _ = kwargs
        return al.performance.cumulative_returns(returns)
