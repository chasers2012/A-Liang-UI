"""Built-in workflow node: mean information coefficient (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import BooleanNodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Mean IC",
    description="计算平均信息系数 IC，可按时间窗或分组对 IC 求均值。",
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
            description="True 时输出按 group 拆分结果",
        ),
        # by_time 为空字符串时视为不传（最终传 None 给 alphalens）
        StringNodeParam(
            "by_time",
            required=False,
            default="",
            label="时间分组",
            description="例如 M/W；为空表示不按时间分组",
        ),
    ],
    output_sockets=[
        Socket(
            "mean_ic",
            value_type="scalar_json",
            label="平均 IC",
            description="Mean IC 结果\n\n**数据格式**\n- JSON 可序列化对象（dict/series 结构，键为周期或分组）",
        ),
    ],
    entry="evaluate",
)
class MeanIC:
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        group_adjust: bool = False,
        by_group: bool = False,
        by_time: str = "",
        **kwargs: Any,
    ) -> pd.Series | pd.DataFrame:
        import alphalens as al

        _ = kwargs
        by_time_val = by_time or None
        return al.performance.mean_information_coefficient(
            clean_factor,
            group_adjust=group_adjust,
            by_group=by_group,
            by_time=by_time_val,
        )
