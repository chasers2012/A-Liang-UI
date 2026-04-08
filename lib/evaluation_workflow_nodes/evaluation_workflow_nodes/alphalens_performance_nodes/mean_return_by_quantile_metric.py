"""Built-in workflow node: mean return by quantile (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Mean Return by Quantile",
    description="按因子分位计算均值收益与标准误，可按日期或分组统计。",
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
        BooleanNodeParam(
            "by_date",
            required=False,
            default=False,
            label="按日期输出",
            description="True 时返回按日期拆分的结果",
        ),
        BooleanNodeParam(
            "by_group",
            required=False,
            default=False,
            label="按分组输出",
            description="True 时返回按 group 拆分结果",
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
            description="是否在组内做中性化调整",
        ),
    ],
    output_sockets=[
        Socket(
            "mean_return_by_quantile",
            value_type="dataframe",
            label="分位平均收益",
            description="各分位桶的平均收益\n\n**数据格式**\n- pd.DataFrame，index 为 quantile（可含 date/group 层级），columns 为收益周期",
        ),
        Socket(
            "mean_return_by_quantile_std_error",
            value_type="dataframe",
            label="分位平均收益标准误",
            description="各分位桶收益的标准误\n\n**数据格式**\n- pd.DataFrame，index/columns 与 mean_return_by_quantile 对齐",
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
