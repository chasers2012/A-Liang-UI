"""Built-in workflow node: mean information coefficient (Alphalens)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pandas as pd
from evaluate import MeanInformationCoefficientMetric
from evaluate.alphalens_panel_utils import jsonable_metric_value, series_to_period_dict
from workflow import WorkflowNode, workflow_node, workflow_socket


@workflow_node(
    type_id="builtin_mean_ic",
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
    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
    ) -> dict[str, Any]:
        fdc = inputs["clean_factor"]
        if not isinstance(fdc, pd.DataFrame):
            raise TypeError("clean_factor 须为 DataFrame")
        raw = MeanInformationCoefficientMetric().evaluate(fdc)
        sock = "mean_ic"
        mean_ic_val = jsonable_metric_value(raw)
        merged: dict[str, float] = {}
        series = raw
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        if isinstance(series, pd.Series):
            merged = series_to_period_dict(series)
        return {sock: mean_ic_val, "merged_mean_ic": merged}
