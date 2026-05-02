"""Built-in workflow node: get_clean_factor_and_forward_returns (Alphalens)."""

from __future__ import annotations

from typing import Any, cast

import pandas as pd
from workflow import BooleanNodeParam, NumberNodeParam, Socket, workflow_node
from workflow.node_types import StringNodeParam


def _int_or_tuple_from_numeric_seq(
    seq: list | tuple,
    *,
    if_empty: int | tuple[float, ...] | None,
) -> int | tuple[float, ...] | None:
    if len(seq) == 0:
        return if_empty
    if len(seq) == 1:
        return int(float(seq[0]))
    return tuple(float(x) for x in seq)


def _int_or_tuple_from_csv(
    s: str,
    *,
    if_empty: int | tuple[float, ...] | None,
) -> int | tuple[float, ...] | None:
    tokens = [p.strip() for p in s.split(",") if p.strip()]
    if not tokens:
        return if_empty
    if len(tokens) == 1:
        return int(float(tokens[0]))
    return tuple(float(t) for t in tokens)


def _parse_quantiles_kwarg(raw: Any, *, default: int = 5) -> int | tuple[float, ...]:
    if raw is None or isinstance(raw, bool):
        return default
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    if isinstance(raw, (list, tuple)):
        return cast(int | tuple[float, ...], _int_or_tuple_from_numeric_seq(raw, if_empty=default))
    if isinstance(raw, str):
        return cast(int | tuple[float, ...], _int_or_tuple_from_csv(raw, if_empty=default))
    return default


def _parse_bins_kwarg(raw: Any) -> int | tuple[float, ...] | None:
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    if isinstance(raw, (list, tuple)):
        return _int_or_tuple_from_numeric_seq(raw, if_empty=None)
    if isinstance(raw, str):
        return _int_or_tuple_from_csv(raw, if_empty=None)
    return None


def _parse_periods_kwarg(raw: Any) -> tuple[int, ...]:
    default = (1, 5, 10)
    if raw is None:
        return default
    if isinstance(raw, (list, tuple)):
        if len(raw) == 0:
            return default
        return tuple(int(p) for p in raw)
    if isinstance(raw, str):
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        return tuple(int(p) for p in parts) if parts else default
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return (int(raw),)
    return default


def _coerce_max_loss_kwarg(raw: Any, *, default: float = 0.35) -> float:
    if raw is None:
        return default
    return float(raw)


def _coerce_filter_zscore_kwarg(raw: Any) -> int | float | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, float) and raw != raw:
        return None
    return float(raw) if isinstance(raw, float) else int(raw)


@workflow_node(
    label="计算因子前向收益",
    description=(
        "直接调用 Alphalens 的 get_clean_factor_and_forward_returns，生成清洗后的因子与前向收益表。\n\n"
        "**输入示例**\n\n"
        "`factor`：`pd.Series`（MultiIndex：`date`, `asset`）\n\n"
        "| date | asset | factor |\n"
        "|------|-------|--------|\n"
        "| 2024-01-02 | AAPL | 0.82 |\n"
        "| 2024-01-02 | MSFT | 1.15 |\n"
        "| 2024-01-03 | AAPL | 0.76 |\n\n"
        "`prices`：`pd.DataFrame`，index 为日期、columns 为资产\n\n"
        "| date | AAPL | MSFT |\n"
        "|------|------|------|\n"
        "| 2024-01-02 | 185.2 | 402.1 |\n"
        "| 2024-01-03 | 186.0 | 405.6 |\n\n"
        "**输出示例**\n\n"
        "`clean_factor`：清洗后的 `DataFrame`，通常包含 `factor`、`1D`、`5D`、`10D`、`factor_quantile` 等列\n\n"
        "| date | asset | factor | 1D | 5D | factor_quantile |\n"
        "|------|-------|--------|----|----|-----------------|\n"
        "| 2024-01-02 | AAPL | 0.82 | 0.01 | 0.03 | 4 |\n"
        "| 2024-01-02 | MSFT | 1.15 | -0.02 | 0.04 | 5 |\n"
    ),
    category="Alphalens Performance",
    input_sockets=[
        Socket(
            "factor",
            required=True,
            value_type="series",
            label="因子序列",
            description="MultiIndex Series，索引为 (date, asset)。输入示例见节点说明。",
        ),
        Socket(
            "prices",
            required=True,
            value_type="dataframe",
            label="价格矩阵",
            description="行索引为日期，列索引为资产的价格 DataFrame。输入示例见节点说明。",
        ),
        StringNodeParam(
            "quantiles",
            required=False,
            default="5",
            label="分位数",
            description="单个整数或逗号分隔的分位点序列。",
        ),
        StringNodeParam(
            "periods",
            required=False,
            default="1, 5, 10",
            label="持有期",
            description="前向收益持有期，英文逗号分隔，如 `1, 5, 10`。",
        ),
        NumberNodeParam(
            "max_loss",
            required=False,
            default=0.35,
            minimum=0,
            maximum=1,
            label="最大缺失率",
            description="允许丢弃数据占比上限。",
        ),
        BooleanNodeParam(
            "binning_by_group",
            required=False,
            default=False,
            label="按组分桶",
            description="为 True 时在每个分组内单独分桶。",
        ),
        Socket(
            "groupby",
            required=False,
            value_type="series",
            label="分组",
            description="可选的 MultiIndex Series 或资产到分组的映射。",
        ),
        StringNodeParam(
            "bins",
            required=False,
            label="自定义分位边界",
            description="可选的分箱个数或显式边界序列。",
        ),
        NumberNodeParam(
            "filter_zscore",
            required=False,
            default=None,
            label="Z-score 过滤",
            description="前向收益异常值过滤阈值。",
        ),
        Socket(
            "groupby_labels",
            required=False,
            value_type="json",
            label="分组标签",
            description="组代码到展示名称的映射。",
        ),
        BooleanNodeParam(
            "zero_aware",
            required=False,
            default=False,
            label="零值感知分桶",
            description="对正负信号分别分桶。",
        ),
        BooleanNodeParam(
            "cumulative_returns",
            required=False,
            default=True,
            label="累积收益",
            description="是否使用累积前向收益。",
        ),
    ],
    output_sockets=[
        Socket(
            "clean_factor",
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description=(
                "Alphalens 清洗后的因子和前向收益 DataFrame。\n\n"
                "**输出示例**\n\n"
                "| date | asset | factor | 1D | 5D | factor_quantile |\n"
                "|------|-------|--------|----|----|-----------------|\n"
                "| 2024-01-02 | AAPL | 0.82 | 0.01 | 0.03 | 4 |\n"
                "| 2024-01-02 | MSFT | 1.15 | -0.02 | 0.04 | 5 |"
            ),
        ),
    ],
    entry="evaluate",
)
class GetCleanFactorAndForwardReturnsMetric:
    def evaluate(self, factor: pd.Series, prices: pd.DataFrame, **kwargs: Any) -> pd.DataFrame:
        import alphalens as al

        groupby = kwargs.pop("groupby", None)
        groupby_labels = kwargs.pop("groupby_labels", None)
        quantiles = _parse_quantiles_kwarg(kwargs.pop("quantiles", "5"))
        periods = _parse_periods_kwarg(kwargs.pop("periods", "1, 5, 10"))
        max_loss = _coerce_max_loss_kwarg(kwargs.pop("max_loss", 0.35))
        bins = _parse_bins_kwarg(kwargs.pop("bins", None))
        filter_zscore = _coerce_filter_zscore_kwarg(kwargs.pop("filter_zscore", None))
        binning_by_group = bool(kwargs.pop("binning_by_group", False))
        zero_aware = bool(kwargs.pop("zero_aware", False))
        cumulative_returns = bool(kwargs.pop("cumulative_returns", True))
        _ = kwargs

        return al.utils.get_clean_factor_and_forward_returns(
            factor=factor,
            prices=prices,
            groupby=groupby,
            binning_by_group=binning_by_group,
            quantiles=quantiles,
            bins=bins,
            periods=periods,
            filter_zscore=filter_zscore,
            groupby_labels=groupby_labels,
            max_loss=max_loss,
            zero_aware=zero_aware,
            cumulative_returns=cumulative_returns,
        )
