"""Built-in workflow node: quantile turnover (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Quantile Turnover",
    description="计算分位桶的换手率/流动性（Alphalens.performance.quantile_turnover）",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出",
        ),
        Socket(
            "quantile_factor",
            required=False,
            value_type="dataframe",
            label="分位序列(可选)",
            description="可选传入 factor_quantile 序列",
        ),
    ],
    workflow_parameters=[
        NumberNodeParam(
            "quantile",
            required=False,
            default=5,
            label="目标分位",
            description="计算换手率的分位编号",
        ),
        NumberNodeParam(
            "period", required=False, default=1, label="回看期", description="换手率计算期数"
        ),
    ],
    output_sockets=[
        Socket(
            "quantile_turnover",
            value_type="scalar_json",
            label="分位换手率",
            description="目标分位的换手率时间序列；格式：JSON 可序列化时间序列（dict[datetime, number]）",
        ),
    ],
    entry="evaluate",
)
class QuantileTurnoverMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        quantile_factor: pd.Series | None = None,
        *,
        quantile: int = 5,
        period: int = 1,
        **kwargs: Any,
    ) -> pd.Series:
        import alphalens as al

        _ = kwargs
        qf = quantile_factor if quantile_factor is not None else clean_factor["factor_quantile"]
        return al.performance.quantile_turnover(qf, quantile=quantile, period=period)
