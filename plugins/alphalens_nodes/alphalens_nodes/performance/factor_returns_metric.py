"""Built-in workflow node: factor returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import BooleanNodeParam, Socket, workflow_node


@workflow_node(
    label="Factor Returns",
    description="根据因子权重计算各持有期组合收益，可按资产维度返回。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出",
        ),
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
        BooleanNodeParam(
            "by_asset",
            required=False,
            default=False,
            label="按资产输出",
            description="True 时返回逐资产收益",
        ),
    ],
    output_sockets=[
        Socket(
            "returns",
            value_type="dataframe",
            label="因子收益",
            description="因子组合收益 DataFrame\n\n**数据格式**\n- pd.DataFrame，index 为日期，columns 为收益列或资产列",
        ),
    ],
    entry="evaluate",
)
class FactorReturnsMetric:
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        *,
        demeaned: bool = True,
        group_adjust: bool = False,
        equal_weight: bool = False,
        by_asset: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.factor_returns(
            clean_factor,
            demeaned=demeaned,
            group_adjust=group_adjust,
            equal_weight=equal_weight,
            by_asset=by_asset,
        )
