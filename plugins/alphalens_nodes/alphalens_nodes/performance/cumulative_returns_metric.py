"""Built-in workflow node: cumulative returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, workflow_node


@workflow_node(
    label="Cumulative Returns",
    description="将简单收益序列转换为累计收益时间序列。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "returns",
            required=True,
            value_type="json",
            label="收益序列",
            description="简单收益率序列",
        ),
    ],
    output_sockets=[
        Socket(
            "cumulative_returns",
            value_type="json",
            label="累计收益序列",
            description="累计化后的收益序列\n\n**数据格式**\n- JSON 可序列化时间序列（dict[datetime, number]）",
        ),
    ],
    entry="evaluate",
)
class CumulativeReturnsMetric:
    def evaluate(self, returns: pd.Series, **kwargs: Any) -> pd.Series:
        import alphalens as al

        _ = kwargs
        return al.performance.cumulative_returns(returns)
