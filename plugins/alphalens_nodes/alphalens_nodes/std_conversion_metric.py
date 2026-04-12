"""Built-in workflow node: convert standard deviation across periods."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Std Conversion",
    description="单周期标准差（或标准误差）近似值",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "std",
            required=True,
            value_type="dataframe",
            label="多周期标准差",
            description="包含标准差或标准误差值的 DataFrame，列标题表示重现期。",
        ),
    ],
    workflow_parameters=[
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
            "std_converted",
            value_type="dataframe",
            label="标准差折算结果",
            description="数据框格式与输入格式相同，但标准差/误差值为单周期值。",
        ),
    ],
    entry="evaluate",
)
class StdConversionMetric:
    def evaluate(
        self,
        std: pd.DataFrame,
        *,
        base_period: str = "",
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        if std.empty:
            raise ValueError("std must not be empty")

        base = base_period or str(std.columns[0])
        return std.apply(al.utils.std_conversion, axis=0, base_period=base)
