"""Built-in workflow node: mean information coefficient (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import MeanInformationCoefficientMetric
from workflow import workflow_node, workflow_socket


@workflow_node(
    label="平均 IC",
    description="各持有期平均信息系数（Alphalens）",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[
        workflow_socket("mean_ic", value_type="scalar_json"),
        workflow_socket("merged_mean_ic", value_type="scalar_json"),
    ],
)
class BuiltinMeanIcNode:
    def execute(self, **kwargs: Any) -> dict[str, Any]:
        fdc = kwargs["clean_factor"]
        if not isinstance(fdc, pd.DataFrame):
            raise TypeError("clean_factor 须为 DataFrame")
        return MeanInformationCoefficientMetric().evaluate(fdc)
