"""Built-in workflow node: common start returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import BooleanNodeParam, NumberNodeParam, Socket, workflow_node


@workflow_node(
    label="Common Start Returns",
    description="提取并对齐事件窗口收益，将每个事件日前后窗口统一到共同时间轴（-before 到 +after）。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由计算因子节点输出",
        ),
        # wide format: index=date, columns=asset
        Socket(
            "returns",
            required=True,
            value_type="dataframe",
            label="收益矩阵",
            description="index=date, columns=asset 的宽表收益",
        ),
        # 可选：提供用于长短组合去均值的 universe
        Socket(
            "demean_by",
            required=False,
            value_type="dataframe",
            label="去均值参考(可选)",
            description="可选传入用于去均值的基准样本集合",
        ),
        NumberNodeParam(
            "before",
            required=False,
            default=10,
            label="事件前窗口",
            description="事件日前回溯期数",
        ),
        NumberNodeParam(
            "after", required=False, default=15, label="事件后窗口", description="事件日后观察期数"
        ),
        BooleanNodeParam(
            "cumulative",
            required=False,
            default=False,
            label="累计收益",
            description="是否输出累计收益",
        ),
        BooleanNodeParam(
            "mean_by_date",
            required=False,
            default=False,
            label="按日期求均值",
            description="是否在日期维度求平均",
        ),
    ],
    output_sockets=[
        Socket(
            "aligned_returns",
            value_type="dataframe",
            label="对齐收益窗口",
            description="事件日对齐后的收益窗口\n\n**数据格式**\n- pd.DataFrame，index 为相对事件期，columns 为资产或样本",
        ),
    ],
    entry="evaluate",
)
class CommonStartReturnsMetric:
    def evaluate(
        self,
        clean_factor: pd.DataFrame,
        returns: pd.DataFrame,
        demean_by: pd.DataFrame | None = None,
        *,
        before: int = 10,
        after: int = 15,
        cumulative: bool = False,
        mean_by_date: bool = False,
        **kwargs: Any,
    ) -> pd.DataFrame:
        import alphalens as al

        _ = kwargs
        return al.performance.common_start_returns(
            clean_factor,
            returns,
            before=before,
            after=after,
            cumulative=cumulative,
            mean_by_date=mean_by_date,
            demean_by=demean_by,
        )
