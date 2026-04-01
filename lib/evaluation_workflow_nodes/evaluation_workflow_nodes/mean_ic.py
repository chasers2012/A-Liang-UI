"""Built-in workflow node: mean information coefficient (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric, MeanInformationCoefficientMetric
from evaluate.alphalens_panel_utils import jsonable_metric_value, series_to_period_dict
from workflow import OptionsNodeParam, Socket, workflow_node


@workflow_node(
    label="平均 IC",
    description="各持有期平均信息系数（Alphalens）",
    category="factor_evaluation",
    input_sockets=[
        Socket("clean_factor", required=True, value_type="factor_data_clean"),
        OptionsNodeParam("test_param", options=lambda: [1, 2, 3]),
    ],
    output_sockets=[
        Socket("mean_ic", value_type="scalar_json"),
        Socket("merged_mean_ic", value_type="scalar_json"),
    ],
    entry="evaluate",
)
class MeanIC(EvaluationMetric):
    def evaluate(self, **kwargs: Any) -> tuple[Any, dict[str, float]]:
        fdc = kwargs["clean_factor"]
        if not isinstance(fdc, pd.DataFrame):
            raise TypeError("clean_factor 须为 DataFrame")
        raw = MeanInformationCoefficientMetric().evaluate(fdc)
        mean_ic_val = jsonable_metric_value(raw)
        series: pd.Series | pd.DataFrame = raw
        if isinstance(raw, pd.DataFrame):
            series = raw.iloc[:, 0]
        merged: dict[str, float] = (
            series_to_period_dict(series) if isinstance(series, pd.Series) else {}
        )
        return mean_ic_val, merged
