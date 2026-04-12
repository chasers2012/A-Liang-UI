"""Built-in workflow node: factor cumulative returns (Alphalens)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import BooleanNodeParam, Socket, StringNodeParam, workflow_node


def _coerce_quantiles_filter_arg(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return None
        if "," in s:
            return [int(p.strip()) for p in s.split(",") if p.strip()]
        return raw
    if isinstance(raw, (list, tuple)):
        return [int(x) for x in raw] if raw else None
    return raw


def _coerce_groups_filter_arg(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return None
        if "," in s:
            return [p.strip() for p in s.split(",") if p.strip()]
        return raw
    if isinstance(raw, (list, tuple)):
        return list(raw) if raw else None
    return raw


@workflow_node(
    label="Factor Cumulative Returns",
    description="使用输入因子模拟投资组合，并返回模拟投资组合的累计收益。",
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "clean_factor",
            required=True,
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="由`计算因子`节点输出",
        ),
    ],
    workflow_parameters=[
        StringNodeParam(
            "period",
            required=False,
            default="1D",
            label="持有期",
            description="持有周期（如 `1D`、`5D`），需要是清洗后因子数据中的列名",
        ),
        BooleanNodeParam(
            "long_short",
            required=False,
            default=True,
            label="多空组合",
            description="是否构建 long-short 组合",
        ),
        BooleanNodeParam(
            "group_neutral",
            required=False,
            default=False,
            label="分组中性",
            description="是否进行组别中性化",
        ),
        BooleanNodeParam(
            "equal_weight",
            required=False,
            default=False,
            label="等权",
            description="是否使用等权重",
        ),
        StringNodeParam(
            "quantiles",
            required=False,
            default=None,
            label="指定分位",
            description="限制参与计算的分位集合，逗号分隔的数字序列，（如 `1, 5`）",
        ),
        StringNodeParam(
            "groups",
            required=False,
            default=None,
            label="指定分组",
            description="限制参与计算的组别集合，默认使用所有组别，逗号分隔，如`group_1, group_2`",
        ),
    ],
    output_sockets=[
        Socket(
            "cumulative_returns",
            value_type="series",
            label="累计收益",
            description=(
                "累计收益 pandas Series，例如：\n\n"
                "|  |  |\n"
                "|------|----------|\n"
                "| 2015-07-16 09:30:00 | -0.012143 |\n"
                "| 2015-07-16 12:30:00 | 0.012546 |\n"
                "| 2015-07-17 09:30:00 | 0.045350 |\n"
                "| 2015-07-17 12:30:00 | 0.065897 |\n"
                "| 2015-07-20 09:30:00 | 0.030957 |\n"
            ),
        ),
    ],
    entry="evaluate",
)
class FactorCumulativeReturnsMetric:
    def evaluate(self, **kwargs: Any) -> pd.Series:
        import alphalens as al

        # input_sockets
        clean_factor: pd.DataFrame = kwargs.pop("clean_factor")
        # workflow_parameters
        period = str(kwargs.pop("period", "1D"))
        long_short = bool(kwargs.pop("long_short", True))
        group_neutral = bool(kwargs.pop("group_neutral", False))
        equal_weight = bool(kwargs.pop("equal_weight", False))
        quantiles = _coerce_quantiles_filter_arg(kwargs.pop("quantiles", None))
        groups = _coerce_groups_filter_arg(kwargs.pop("groups", None))
        _ = kwargs

        return al.performance.factor_cumulative_returns(
            clean_factor,
            period,
            long_short=long_short,
            group_neutral=group_neutral,
            equal_weight=equal_weight,
            quantiles=quantiles,
            groups=groups,
        )
