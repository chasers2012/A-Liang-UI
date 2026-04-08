"""Built-in workflow node: convert period return to rate of return."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Rate of Return",
    description="将不同持有期收益折算为统一基准周期的收益率。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "returns",
            required=True,
            value_type="dataframe",
            label="多周期收益",
            description="列为不同持有期的收益矩阵",
        ),
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
        Socket(
            "rate_of_return",
            value_type="dataframe",
            label="单位收益率",
            description="折算到基准周期后的收益率\n\n**数据格式**\n- pd.DataFrame，index 与输入一致，columns 为各周期收益率列",
        ),
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
