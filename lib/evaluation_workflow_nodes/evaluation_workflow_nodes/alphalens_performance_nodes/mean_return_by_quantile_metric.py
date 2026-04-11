"""Built-in workflow node: mean return by quantile (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Mean Return by Quantile",
    description="计算给定未来收益列中各因子分位数的平均收益。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由`计算因子`节点输出",
        ),
    ],
    workflow_parameters=[
        BooleanNodeParam(
            "by_date",
            required=False,
            default=False,
            label="按日期输出",
            description="如果为`True`，则分别计算每个日期的分位数桶收益率。",
        ),
        BooleanNodeParam(
            "by_group",
            required=False,
            default=False,
            label="按分组输出",
            description="如果为`True`，则分别计算每个组的分位数桶收益率。",
        ),
        BooleanNodeParam(
            "demeaned",
            required=False,
            default=True,
            label="去均值",
            description="计算去均值平均收益率（多空投资组合）",
        ),
        BooleanNodeParam(
            "group_adjust",
            required=False,
            default=False,
            label="分组中性化",
            description="是否在组内做中性化调整",
        ),
    ],
    output_sockets=[
        Socket(
            "mean_return_by_quantile",
            value_type="dataframe",
            label="分位平均收益",
            description="按指定因子分位数计算各时期平均收益率。",
        ),
        Socket(
            "mean_return_by_quantile_std_error",
            value_type="dataframe",
            label="分位平均收益标准误",
            description="按指定分位数计算的收益率标准误差。",
        ),
    ],
    entry="evaluate",
)
class MeanReturnByQuantileMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        by_date: bool = False,
        by_group: bool = False,
        demeaned: bool = True,
        group_adjust: bool = False,
        **kwargs: Any,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        import alphalens as al

        _ = kwargs
        return al.performance.mean_return_by_quantile(
            clean_factor,
            by_date=by_date,
            by_group=by_group,
            demeaned=demeaned,
            group_adjust=group_adjust,
        )
