"""Built-in workflow node: create pyfolio input (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import (
    BooleanNodeParam,
    NodeParam,
    NumberNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)


@workflow_node(
    label="Pyfolio Input",
    description="为 Pyfolio 格式生成收益/持仓/基准（Alphalens.performance.create_pyfolio_input）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        StringNodeParam("period", required=False, default="1D"),
        NumberNodeParam("capital", required=False, default=None),
        BooleanNodeParam("long_short", required=False, default=True),
        BooleanNodeParam("group_neutral", required=False, default=False),
        BooleanNodeParam("equal_weight", required=False, default=False),
        NodeParam("quantiles", required=False, value_type="scalar_json", default=None),
        NodeParam("groups", required=False, value_type="scalar_json", default=None),
        StringNodeParam("benchmark_period", required=False, default="1D"),
    ],
    output_sockets=[
        Socket("returns", value_type="scalar_json"),
        Socket("positions", value_type="dataframe"),
        Socket("benchmark", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class CreatePyfolioInputMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        period: str = "1D",
        capital: float | None = None,
        long_short: bool = True,
        group_neutral: bool = False,
        equal_weight: bool = False,
        quantiles: Any = None,
        groups: Any = None,
        benchmark_period: str = "1D",
        **kwargs: Any,
    ) -> tuple[pd.Series, pd.DataFrame, pd.Series | None]:
        import alphalens as al

        _ = kwargs
        return al.performance.create_pyfolio_input(
            clean_factor,
            period,
            capital=capital,
            long_short=long_short,
            group_neutral=group_neutral,
            equal_weight=equal_weight,
            quantiles=quantiles,
            groups=groups,
            benchmark_period=benchmark_period,
        )
