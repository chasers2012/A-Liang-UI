"""Built-in workflow node: mean long-short quantile spread (Alphalens)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pandas as pd
from evaluate import MeanReturnSpreadMetric
from evaluate.alphalens_panel_utils import jsonable_metric_value, series_to_period_dict
from workflow import WorkflowNode, workflow_node, workflow_socket


@workflow_node(
    type_id="builtin_mean_return_spread",
    label="多空收益差",
    description="分位多空平均收益差（按持有期）",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
    ],
    output_sockets=[workflow_socket("mean_return_spread", value_type="scalar_json")],
)
class BuiltinMeanReturnSpreadNode:
    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
        ctx: Any,
    ) -> dict[str, Any]:
        fdc = inputs["clean_factor"]
        if not isinstance(fdc, pd.DataFrame):
            raise TypeError("clean_factor 须为 DataFrame")
        last_quantiles: int = ctx["last_quantiles"]
        raw = MeanReturnSpreadMetric().evaluate(fdc, quantiles=last_quantiles)
        sock = "mean_return_spread"
        ctx["metric_results"][node.id] = {sock: jsonable_metric_value(raw)}
        if isinstance(raw, pd.Series):
            ctx["merged_spread"] = series_to_period_dict(raw)
        return {sock: raw}
