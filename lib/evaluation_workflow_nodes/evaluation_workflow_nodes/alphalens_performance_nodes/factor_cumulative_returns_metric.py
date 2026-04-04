"""Built-in workflow node: factor cumulative returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, NodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Factor Cumulative Returns",
    description="基于因子构建多空组合并计算累计收益（Alphalens.performance.factor_cumulative_returns）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        StringNodeParam("period", required=False, default="1D"),
        BooleanNodeParam("long_short", required=False, default=True),
        BooleanNodeParam("group_neutral", required=False, default=False),
        BooleanNodeParam("equal_weight", required=False, default=False),
        NodeParam("quantiles", required=False, value_type="scalar_json", default=None),
        NodeParam("groups", required=False, value_type="scalar_json", default=None),
    ],
    output_sockets=[
        Socket("cumulative_returns", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class FactorCumulativeReturnsMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        period: str = "1D",
        long_short: bool = True,
        group_neutral: bool = False,
        equal_weight: bool = False,
        quantiles: Any = None,
        groups: Any = None,
        **kwargs: Any,
    ) -> pd.Series:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_cumulative_returns(
            clean_factor,
            period,
            long_short=long_short,
            group_neutral=group_neutral,
            equal_weight=equal_weight,
            quantiles=quantiles,
            groups=groups,
        )
