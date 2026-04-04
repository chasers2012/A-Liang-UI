"""Built-in workflow node: factor positions (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, NodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Factor Positions",
    description="基于因子构建组合并输出资产持仓（Alphalens.performance.factor_positions）",
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
        Socket("positions", value_type="dataframe"),
    ],
    entry="evaluate",
)
class FactorPositionsMetric(EvaluationMetric):
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
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_positions(
            clean_factor,
            period,
            long_short=long_short,
            group_neutral=group_neutral,
            equal_weight=equal_weight,
            quantiles=quantiles,
            groups=groups,
        )
