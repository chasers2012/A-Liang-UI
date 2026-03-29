# builtin metric: mean IC (seeded template)
from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import MeanInformationCoefficientMetric
from workflow import workflow_node, workflow_socket


@workflow_node(
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[workflow_socket("mean_ic", value_type="scalar_json")],
    record_field="mean_ic",
    visualization={"mode": "auto", "period_day_keys": True},
)
class BuiltinMeanICMetric(MeanInformationCoefficientMetric):
    """各持有期平均信息系数（Alphalens）。"""

    def evaluate(self, factor_data_clean: pd.DataFrame, **kwargs: Any) -> pd.Series | pd.DataFrame:
        _ = kwargs
        return super().evaluate(factor_data_clean)
