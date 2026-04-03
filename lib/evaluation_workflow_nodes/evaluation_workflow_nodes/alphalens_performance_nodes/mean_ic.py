"""Built-in workflow node: mean information coefficient (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Mean IC",
    description="各持有期平均信息系数（Alphalens）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        BooleanNodeParam("group_adjust", required=False, default=False),
        BooleanNodeParam("by_group", required=False, default=False),
        # by_time 为空字符串时视为不传（最终传 None 给 alphalens）
        StringNodeParam("by_time", required=False, default=""),
    ],
    output_sockets=[
        Socket("mean_ic", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class MeanIC(EvaluationMetric):
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
