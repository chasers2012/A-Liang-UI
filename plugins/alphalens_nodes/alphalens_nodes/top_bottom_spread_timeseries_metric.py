"""Built-in workflow node: top-bottom quantile spread time series (from mean returns by date)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NumberNodeParam, Socket, StringNodeParam, workflow_node


@workflow_node(
    label="Top-Bottom Quantile Spread TS",
    description="计算 Top-Bottom 分位收益差时间序列，并提供滚动均值辅助观察趋势。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "mean_returns_bydate",
            required=True,
            value_type="dataframe",
            label="分位日收益",
            description="按 (factor_quantile, date) 组织的 MultiIndex DataFrame",
        ),
    ],
    workflow_parameters=[
        StringNodeParam(
            "period",
            required=False,
            default="1D",
            label="周期列名",
            description="用于计算收益差的收益列名（如 1D、5D）",
        ),
        NumberNodeParam(
            "upper_quant",
            required=False,
            default=5,
            label="高分位",
            description="spread 分子的分位编号",
        ),
        NumberNodeParam(
            "lower_quant",
            required=False,
            default=1,
            label="低分位",
            description="spread 分母对应对比的分位编号",
        ),
        NumberNodeParam(
            "rolling_window",
            required=False,
            default=22,
            label="滚动窗口(交易日)",
            description="均线窗口长度",
        ),
    ],
    output_sockets=[
        Socket(
            "spread_ts",
            value_type="dataframe",
            label="分位差时间序列",
            description="包含 spread 与其滚动均值 ma\n\n**数据格式**\n- pd.DataFrame，index 为日期，columns 固定为 spread/ma",
        ),
    ],
    entry="evaluate",
)
class TopBottomSpreadTimeSeriesMetric(EvaluationMetric):
    def evaluate(
        self,
        mean_returns_bydate: pd.DataFrame,
        *,
        period: str = "1D",
        upper_quant: int = 5,
        lower_quant: int = 1,
        rolling_window: int = 22,
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

        frame = mean_returns_bydate[[period]].reset_index()
        wide = frame.pivot(index="date", columns="factor_quantile", values=period).sort_index()

        if upper_quant not in wide.columns:
            raise KeyError(f"upper_quant {upper_quant} not present in quantile columns")
        if lower_quant not in wide.columns:
            raise KeyError(f"lower_quant {lower_quant} not present in quantile columns")

        spread = wide[upper_quant] - wide[lower_quant]
        ma = spread.rolling(int(rolling_window), min_periods=1).mean()
        return pd.DataFrame({"spread": spread, "ma": ma})
