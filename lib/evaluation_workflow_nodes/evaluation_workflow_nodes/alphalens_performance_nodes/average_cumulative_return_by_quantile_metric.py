"""Built-in workflow node: average cumulative return by quantile (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Avg Cum Return by Quantile",
    description="按分位桶的平均累计收益曲线（Alphalens.performance.average_cumulative_return_by_quantile）",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出",
        ),
        # wide format: index=date, columns=asset
        Socket(
            "returns",
            required=True,
            value_type="dataframe",
            label="收益矩阵",
            description="index=date, columns=asset 的宽表收益",
        ),
    ],
    workflow_parameters=[
        NumberNodeParam(
            "periods_before",
            required=False,
            default=10,
            label="事件前窗口",
            description="事件日前回溯期数",
        ),
        NumberNodeParam(
            "periods_after",
            required=False,
            default=15,
            label="事件后窗口",
            description="事件日后观察期数",
        ),
        BooleanNodeParam(
            "demeaned",
            required=False,
            default=True,
            label="去均值",
            description="是否按横截面去均值",
        ),
        BooleanNodeParam(
            "group_adjust",
            required=False,
            default=False,
            label="分组中性化",
            description="是否在组内中性化",
        ),
        BooleanNodeParam(
            "by_group",
            required=False,
            default=False,
            label="按分组输出",
            description="True 时按 group 拆分结果",
        ),
    ],
    output_sockets=[
        Socket(
            "average_cumulative_return",
            value_type="dataframe",
            label="分位平均累计收益",
            description="各分位桶平均累计收益曲线；格式：pd.DataFrame，index 为事件窗口相对期，columns 为 quantile",
        ),
    ],
    entry="evaluate",
)
class AverageCumulativeReturnByQuantileMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        returns: pd.DataFrame,
        *,
        periods_before: int = 10,
        periods_after: int = 15,
        demeaned: bool = True,
        group_adjust: bool = False,
        by_group: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.average_cumulative_return_by_quantile(
            clean_factor,
            returns,
            periods_before=periods_before,
            periods_after=periods_after,
            demeaned=demeaned,
            group_adjust=group_adjust,
            by_group=by_group,
        )
