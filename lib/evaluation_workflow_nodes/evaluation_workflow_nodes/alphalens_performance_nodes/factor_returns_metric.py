"""Built-in workflow node: factor returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Factor Returns",
    description="根据权重计算分位/因子组合收益（Alphalens.performance.factor_returns）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        BooleanNodeParam("demeaned", required=False, default=True),
        BooleanNodeParam("group_adjust", required=False, default=False),
        BooleanNodeParam("equal_weight", required=False, default=False),
        BooleanNodeParam("by_asset", required=False, default=False),
    ],
    output_sockets=[
        Socket("returns", value_type="dataframe"),
    ],
    entry="evaluate",
)
class FactorReturnsMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        demeaned: bool = True,
        group_adjust: bool = False,
        equal_weight: bool = False,
        by_asset: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_returns(
            clean_factor,
            demeaned=demeaned,
            group_adjust=group_adjust,
            equal_weight=equal_weight,
            by_asset=by_asset,
        )
