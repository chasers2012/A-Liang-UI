"""Built-in workflow node: cumulative returns by quantile (from mean returns by date)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Quantile Cumulative Returns",
    description="将按日期/分位的收益（MultiIndex）转为分位累计收益曲线（每列一个分位）",
    category="Alphalens Performance",
    input_sockets=[
        Socket("mean_returns_bydate", required=True, value_type="dataframe"),
    ],
    workflow_parameters=[
        StringNodeParam("period", required=False, default="1D", label="周期列名"),
    ],
    output_sockets=[
        Socket("cumulative_returns_by_quantile", value_type="dataframe"),
    ],
    entry="evaluate",
)
class QuantileCumulativeReturnsMetric(EvaluationMetric):
    def evaluate(
        self,
        mean_returns_bydate: pd.DataFrame,
        *,
        period: str = "1D",
        **kwargs: Any,
    ) -> pd.DataFrame:
        _ = kwargs

        if not isinstance(mean_returns_bydate, pd.DataFrame) or mean_returns_bydate.empty:
            raise ValueError("mean_returns_bydate must be a non-empty dataframe")
        if not isinstance(mean_returns_bydate.index, pd.MultiIndex):
            raise TypeError(
                "mean_returns_bydate.index must be a MultiIndex (factor_quantile, date)"
            )

        idx_names = [n or "" for n in mean_returns_bydate.index.names]
        if "factor_quantile" not in idx_names or "date" not in idx_names:
            raise ValueError(
                "mean_returns_bydate index must contain levels: factor_quantile and date"
            )

        if period not in mean_returns_bydate.columns:
            raise KeyError(f"period {period!r} not found in dataframe columns")

        # index: (factor_quantile, date) -> index: date, columns: quantile
        frame = mean_returns_bydate[[period]].reset_index()
        wide = frame.pivot(index="date", columns="factor_quantile", values=period).sort_index()
        wide = wide.rename(columns=lambda q: f"Q{q}")

        # simple returns -> cumulative returns
        return (1.0 + wide.fillna(0.0)).cumprod() - 1.0
