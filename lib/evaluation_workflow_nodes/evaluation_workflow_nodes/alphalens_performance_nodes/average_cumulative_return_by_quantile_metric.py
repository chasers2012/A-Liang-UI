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
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
        # wide format: index=date, columns=asset
        Socket("returns", required=True, value_type="dataframe"),
    ],
    workflow_parameters=[
        NumberNodeParam("periods_before", required=False, default=10),
        NumberNodeParam("periods_after", required=False, default=15),
        BooleanNodeParam("demeaned", required=False, default=True),
        BooleanNodeParam("group_adjust", required=False, default=False),
        BooleanNodeParam("by_group", required=False, default=False),
    ],
    output_sockets=[
        Socket("average_cumulative_return", value_type="dataframe"),
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
