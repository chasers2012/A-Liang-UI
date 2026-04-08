"""Built-in workflow node: mean information coefficient (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="IC",
    description="信息系数（Alphalens）",
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
            description="True 时输出按 group 拆分 IC",
        ),
    ],
    output_sockets=[
        Socket(
            "ic",
            value_type="dataframe",
            label="信息系数",
            description="按周期计算得到的 IC；格式：pd.DataFrame，index 为日期（或分组日期），columns 为收益周期",
        ),
    ],
    entry="evaluate",
)
class ICMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        group_adjust: bool = False,
        by_group: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        return al.performance.factor_information_coefficient(
            clean_factor, group_adjust=group_adjust, by_group=by_group
        )
