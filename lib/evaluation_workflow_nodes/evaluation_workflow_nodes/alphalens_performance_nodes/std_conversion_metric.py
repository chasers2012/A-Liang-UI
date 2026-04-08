"""Built-in workflow node: convert standard deviation across periods."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Std Conversion",
    description="将不同周期收益标准差折算到统一基准周期，便于跨周期比较风险。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "std",
            required=True,
            value_type="dataframe",
            label="多周期标准差",
            description="列为不同持有期标准差",
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
            "std_converted",
            value_type="dataframe",
            label="标准差折算结果",
            description="折算到基准周期后的标准差\n\n**数据格式**\n- pd.DataFrame，index 与输入一致，columns 为各周期标准差列",
        ),
    ],
    entry="evaluate",
)
class StdConversionMetric(EvaluationMetric):
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
