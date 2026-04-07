"""Built-in workflow node: convert period return to rate of return."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Rate of Return",
    description="将不同持有期收益统一换算为单位收益率（Alphalens.utils.rate_of_return）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("returns", required=True, value_type="dataframe"),
    ],
    workflow_parameters=[
        StringNodeParam(
            "base_period",
            required=False,
            default="",
            label="基准周期",
            description="为空时自动使用输入 dataframe 的首列",
        ),
    ],
    output_sockets=[
        Socket("rate_of_return", value_type="dataframe"),
    ],
    entry="evaluate",
)
class RateOfReturnMetric(EvaluationMetric):
    def evaluate(
        self,
        returns: pd.DataFrame,
        *,
        base_period: str = "",
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        if returns.empty:
            raise ValueError("returns must not be empty")

        base = base_period or str(returns.columns[0])
        return returns.apply(al.utils.rate_of_return, axis=0, base_period=base)
