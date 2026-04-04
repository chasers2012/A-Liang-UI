"""Built-in workflow node: mean information coefficient (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="IC",
    description="信息系数（Alphalens）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        BooleanNodeParam("group_adjust", required=False, default=False),
        BooleanNodeParam("by_group", required=False, default=False),
    ],
    output_sockets=[
        Socket("ic", value_type="dataframe"),
    ],
    entry="evaluate",
)
class ICMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        group_adjust: bool = False,
        by_group: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        return al.performance.factor_information_coefficient(
            clean_factor, group_adjust=group_adjust, by_group=by_group
        )
