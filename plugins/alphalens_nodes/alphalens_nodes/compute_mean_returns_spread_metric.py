"""Built-in workflow node: compute mean returns spread (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Mean Return Spread",
    description="计算高低分位均值收益差，返回上分位减下分位的收益差及其标准误（可选）。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "mean_returns",
            required=True,
            value_type="dataframe",
            label="分位平均收益",
            description="mean_return_by_quantile 的输出",
        ),
        Socket(
            "std_err",
            required=False,
            value_type="dataframe",
            label="标准误",
            description="可选，mean_return_by_quantile_std_error",
        ),
    ],
    workflow_parameters=[
        NumberNodeParam(
            "upper_quant",
            required=False,
            default=5,
            label="高分位",
            description="用于计算收益差的上分位编号",
        ),
        NumberNodeParam(
            "lower_quant",
            required=False,
            default=1,
            label="低分位",
            description="用于计算收益差的下分位编号",
        ),
    ],
    output_sockets=[
        Socket(
            "mean_return_spread",
            value_type="scalar_json",
            label="分位收益差",
            description="高分位减低分位后的收益差\n\n**数据格式**\n- JSON 可序列化序列（dict[period, number]）",
        ),
        Socket(
            "mean_return_spread_std_error",
            value_type="scalar_json",
            label="分位收益差标准误",
            description="收益差对应标准误\n\n**数据格式**\n- JSON 可序列化序列（dict[period, number]）",
        ),
    ],
    entry="evaluate",
)
class ComputeMeanReturnsSpreadMetric:
    def evaluate(
        self,
        mean_returns: pd.DataFrame,
        std_err: pd.DataFrame | None = None,
        *,
        upper_quant: int = 5,
        lower_quant: int = 1,
        **kwargs: Any,
    ) -> tuple[pd.Series, pd.Series | None]:
        import alphalens as al

        _ = kwargs
        return al.performance.compute_mean_returns_spread(
            mean_returns,
            upper_quant=upper_quant,
            lower_quant=lower_quant,
            std_err=std_err,
        )
