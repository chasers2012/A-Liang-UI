"""Built-in workflow node: factor cumulative returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, NodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Factor Cumulative Returns",
    description="模拟因子组合并计算累计收益，按指定持有期/分位/分组筛选后输出组合累计收益曲线。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出",
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
            description="是否进行组别中性化",
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
            description="限制参与计算的分位集合（如 [1, 5]）",
        ),
        NodeParam(
            "groups",
            required=False,
            value_type="scalar_json",
            default=None,
            label="指定分组",
            description="限制参与计算的组别集合",
        ),
    ],
    output_sockets=[
        Socket(
            "cumulative_returns",
            value_type="scalar_json",
            label="累计收益",
            description="因子组合的累计收益序列\n\n**数据格式**\n- JSON 可序列化时间序列（dict[datetime, number] 或等价结构）",
        ),
    ],
    entry="evaluate",
)
class FactorCumulativeReturnsMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        period: str = "1D",
        long_short: bool = True,
        group_neutral: bool = False,
        equal_weight: bool = False,
        quantiles: Any = None,
        groups: Any = None,
        **kwargs: Any,
    ) -> pd.Series:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_cumulative_returns(
            clean_factor,
            period,
            long_short=long_short,
            group_neutral=group_neutral,
            equal_weight=equal_weight,
            quantiles=quantiles,
            groups=groups,
        )
