"""Built-in workflow node: convert period return to rate of return."""

from __future__ import annotations

from typing import Any

import pandas as pd
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
            description="包含收益率值的 DataFrame，列标题表示收益率周期。",
        ),
        StringNodeParam(
            "base_period",
            required=False,
            default="",
            label="基准周期",
            description="转换中使用的基准周期长度。它必须遵循 pandas.Timedelta 构造函数的格式（例如，`1 days`、`1D`、`30m`、`3h`、`1D1h` 等）。",
        ),
    ],
    output_sockets=[
        Socket(
            "rate_of_return",
            value_type="dataframe",
            label="单位收益率",
            description="与输入格式相同的 DataFrame，但收益率值为 `one_period_len`。",
        ),
    ],
    entry="evaluate",
)
class RateOfReturnMetric:
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
