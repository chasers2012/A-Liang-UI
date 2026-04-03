"""Built-in workflow node: mean return by quantile (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Mean Return by Quantile",
    description="按分位桶计算均值收益与标准误（Alphalens.performance.mean_return_by_quantile）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        BooleanNodeParam("by_date", required=False, default=False),
        BooleanNodeParam("by_group", required=False, default=False),
        BooleanNodeParam("demeaned", required=False, default=True),
        BooleanNodeParam("group_adjust", required=False, default=False),
    ],
    output_sockets=[
        Socket("mean_return_by_quantile", value_type="dataframe"),
        Socket("mean_return_by_quantile_std_error", value_type="dataframe"),
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
