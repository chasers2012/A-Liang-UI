"""Built-in workflow node: mean long-short quantile spread (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import MeanReturnSpreadMetric
from evaluate.alphalens_panel_utils import jsonable_metric_value, series_to_period_dict
from workflow import workflow_node, workflow_socket


@workflow_node(
    label="多空收益差",
    description="分位多空平均收益差（按持有期）",
    input_sockets=[
        workflow_socket("clean_factor", required=True, value_type="factor_data_clean"),
        workflow_socket("last_quantiles", required=True, value_type="scalar_json"),
    ],
    output_sockets=[
        workflow_socket("mean_return_spread", value_type="scalar_json"),
        workflow_socket("merged_spread", value_type="scalar_json"),
    ],
)
class BuiltinMeanReturnSpreadNode:
    def execute(self, **kwargs: Any) -> tuple[Any, dict[str, float]]:
        fdc = kwargs["clean_factor"]
        if not isinstance(fdc, pd.DataFrame):
            raise TypeError("clean_factor 须为 DataFrame")
        last_quantiles: int = int(kwargs["last_quantiles"])
        raw = MeanReturnSpreadMetric().evaluate(fdc, quantiles=last_quantiles)
        spread_val = jsonable_metric_value(raw)
        merged: dict[str, float] = {}
        if isinstance(raw, pd.Series):
            merged = series_to_period_dict(raw)
        return spread_val, merged
