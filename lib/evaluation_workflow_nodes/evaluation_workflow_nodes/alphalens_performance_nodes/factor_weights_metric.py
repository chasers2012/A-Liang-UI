"""Built-in workflow node: factor weights (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Factor Weights",
    description="根据因子构建资产权重（Alphalens.performance.factor_weights）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        BooleanNodeParam("demeaned", required=False, default=True),
        BooleanNodeParam("group_adjust", required=False, default=False),
        BooleanNodeParam("equal_weight", required=False, default=False),
    ],
    output_sockets=[
        Socket("weights", value_type="dataframe"),
    ],
    entry="evaluate",
)
class FactorWeightsMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        demeaned: bool = True,
        group_adjust: bool = False,
        equal_weight: bool = False,
        **kwargs: Any,
    ) -> pd.Series:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_weights(
            clean_factor,
            demeaned=demeaned,
            group_adjust=group_adjust,
            equal_weight=equal_weight,
        )
