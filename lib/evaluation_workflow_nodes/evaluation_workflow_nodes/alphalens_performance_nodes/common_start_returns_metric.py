"""Built-in workflow node: common start returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Common Start Returns",
    description="从事件日对齐的收益窗口（Alphalens.performance.common_start_returns）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
        # wide format: index=date, columns=asset
        Socket("returns", required=True, value_type="dataframe"),
        # 可选：提供用于长短组合去均值的 universe
        Socket("demean_by", required=False, value_type="dataframe"),
    ],
    workflow_parameters=[
        NumberNodeParam("before", required=False, default=10),
        NumberNodeParam("after", required=False, default=15),
        BooleanNodeParam("cumulative", required=False, default=False),
        BooleanNodeParam("mean_by_date", required=False, default=False),
    ],
    output_sockets=[
        Socket("aligned_returns", value_type="dataframe"),
    ],
    entry="evaluate",
)
class CommonStartReturnsMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        returns: pd.DataFrame,
        demean_by: pd.DataFrame | None = None,
        *,
        before: int = 10,
        after: int = 15,
        cumulative: bool = False,
        mean_by_date: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.common_start_returns(
            clean_factor,
            returns,
            before=before,
            after=after,
            cumulative=cumulative,
            mean_by_date=mean_by_date,
            demean_by=demean_by,
        )
