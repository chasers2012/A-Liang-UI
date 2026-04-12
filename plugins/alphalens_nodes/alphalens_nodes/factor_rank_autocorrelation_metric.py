"""Built-in workflow node: factor rank autocorrelation (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Rank Autocorrelation",
    description="计算因子秩自相关，通过比较不同时点的因子排名衡量换手与稳定性。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出",
        ),
    ],
    workflow_parameters=[
        NumberNodeParam(
            "period", required=False, default=1, label="滞后期", description="秩自相关的滞后期长度"
        ),
    ],
    output_sockets=[
        Socket(
            "autocorrelation",
            value_type="scalar_json",
            label="秩自相关",
            description="因子秩自相关时间序列\n\n**数据格式**\n- JSON 可序列化时间序列（dict[datetime, number]）",
        ),
    ],
    entry="evaluate",
)
class FactorRankAutocorrelationMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        period: int = 1,
        **kwargs: Any,
    ) -> pd.Series:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_rank_autocorrelation(clean_factor, period=period)
