"""Built-in workflow node: factor alpha/beta (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from evaluate import EvaluationMetric
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Alpha & Beta",
    description="计算因子组合的 Alpha/Beta，输出超额收益（alpha）与市场暴露（beta）。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出",
        ),
        # 可选：若上游已计算 factor_returns，可直接提供以避免重复计算
        Socket(
            "returns",
            required=False,
            value_type="dataframe",
            label="因子收益(可选)",
            description="可选上游 factor_returns 输出",
        ),
    ],
    workflow_parameters=[
        BooleanNodeParam(
            "demeaned",
            required=False,
            default=True,
            label="去均值",
            description="是否按横截面去均值",
        ),
        BooleanNodeParam(
            "group_adjust",
            required=False,
            default=False,
            label="分组中性化",
            description="是否在组内中性化",
        ),
        BooleanNodeParam(
            "equal_weight",
            required=False,
            default=False,
            label="等权",
            description="是否使用等权重",
        ),
    ],
    output_sockets=[
        Socket(
            "alpha_beta",
            value_type="dataframe",
            label="Alpha/Beta",
            description="Alpha、Beta 与年化 Alpha 指标\n\n**数据格式**\n- pd.DataFrame，index 为指标名，columns 为周期列",
        ),
    ],
    entry="evaluate",
)
class FactorAlphaBetaMetric(EvaluationMetric):
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        returns: pd.DataFrame | None = None,
        *,
        demeaned: bool = True,
        group_adjust: bool = False,
        equal_weight: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_alpha_beta(
            clean_factor,
            returns=returns,
            demeaned=demeaned,
            group_adjust=group_adjust,
            equal_weight=equal_weight,
        )
