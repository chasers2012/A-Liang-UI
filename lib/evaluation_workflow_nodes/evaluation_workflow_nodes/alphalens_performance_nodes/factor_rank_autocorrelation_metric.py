"""Built-in workflow node: factor rank autocorrelation (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Rank Autocorrelation",
    description="因子秩的自相关（Alphalens.performance.factor_rank_autocorrelation）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        NumberNodeParam("period", required=False, default=1),
    ],
    output_sockets=[
        Socket("autocorrelation", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class FactorRankAutocorrelationMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        period: int = 1,
        **kwargs: Any,
    ) -> pd.Series:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_rank_autocorrelation(clean_factor, period=period)
