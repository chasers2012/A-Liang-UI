"""Built-in workflow node: factor alpha/beta (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Alpha & Beta",
    description="计算因子 Alpha、Beta 及其年化 Alpha（Alphalens.performance.factor_alpha_beta）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
        # 可选：若上游已计算 factor_returns，可直接提供以避免重复计算
        Socket("returns", required=False, value_type="dataframe"),
    ],
    workflow_parameters=[
        BooleanNodeParam("demeaned", required=False, default=True),
        BooleanNodeParam("group_adjust", required=False, default=False),
        BooleanNodeParam("equal_weight", required=False, default=False),
    ],
    output_sockets=[
        Socket("alpha_beta", value_type="dataframe"),
    ],
    entry="evaluate",
)
class FactorAlphaBetaMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        returns: pd.DataFrame | None = None,
        *,
        demeaned: bool = True,
        group_adjust: bool = False,
        equal_weight: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_alpha_beta(
            clean_factor,
            returns=returns,
            demeaned=demeaned,
            group_adjust=group_adjust,
            equal_weight=equal_weight,
        )
