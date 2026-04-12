"""Built-in workflow node: create pyfolio input (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import (
    BooleanNodeParam,
    NodeParam,
    NumberNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)


@workflow_node(
    label="Pyfolio Input",
    description="生成 Pyfolio 所需收益/持仓/基准序列。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出的 factor_data_clean",
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
        NumberNodeParam(
            "capital",
            required=False,
            default=None,
            label="资金规模",
            description="可选；用于转换持仓规模",
        ),
        BooleanNodeParam(
            "long_short",
            required=False,
            default=True,
            label="多空组合",
            description="是否构建 long-short 组合",
        ),
        BooleanNodeParam(
            "group_neutral",
            required=False,
            default=False,
            label="分组中性",
            description="是否进行行业/组别中性化",
        ),
        BooleanNodeParam(
            "equal_weight",
            required=False,
            default=False,
            label="等权",
            description="是否使用等权重",
        ),
        NodeParam(
            "quantiles",
            required=False,
            value_type="scalar_json",
            default=None,
            label="指定分位",
            description="限制参与构建的分位集合（如 [1, 5]）",
        ),
        NodeParam(
            "groups",
            required=False,
            value_type="scalar_json",
            default=None,
            label="指定分组",
            description="限制参与构建的组别集合",
        ),
        StringNodeParam(
            "benchmark_period",
            required=False,
            default="1D",
            label="基准周期",
            description="基准收益的周期",
        ),
    ],
    output_sockets=[
        Socket(
            "returns",
            value_type="scalar_json",
            label="策略收益",
            description="Pyfolio 可直接消费的收益序列\n\n**数据格式**\n- JSON 可序列化时间序列（dict[datetime, number]）",
        ),
        Socket(
            "positions",
            value_type="dataframe",
            label="策略持仓",
            description="按时间展开的持仓矩阵\n\n**数据格式**\n- pd.DataFrame，index 为时间，columns 为资产代码",
        ),
        Socket(
            "benchmark",
            value_type="scalar_json",
            label="基准收益",
            description="对应 benchmark_period 的基准收益序列\n\n**数据格式**\n- JSON 可序列化时间序列（dict[datetime, number]）",
        ),
    ],
    entry="evaluate",
)
class CreatePyfolioInputMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        period: str = "1D",
        capital: float | None = None,
        long_short: bool = True,
        group_neutral: bool = False,
        equal_weight: bool = False,
        quantiles: Any = None,
        groups: Any = None,
        benchmark_period: str = "1D",
        **kwargs: Any,
    ) -> tuple[pd.Series, pd.DataFrame, pd.Series | None]:
        import alphalens as al

        _ = kwargs
        return al.performance.create_pyfolio_input(
            clean_factor,
            period,
            capital=capital,
            long_short=long_short,
            group_neutral=group_neutral,
            equal_weight=equal_weight,
            quantiles=quantiles,
            groups=groups,
            benchmark_period=benchmark_period,
        )
