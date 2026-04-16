"""计算因子节点：封装 get_clean_factor_and_forward_returns（经 prepare_factor_data）。"""

from __future__ import annotations

from typing import Any, cast

from evaluate import AlphalensFactorEvaluator
from factor import Factor
from factor.data_set import DataSet
from workflow import (
    BooleanNodeParam,
    NumberNodeParam,
    Socket,
    workflow_node,
)
from workflow.node_types import StringNodeParam

FACTOR_EVALUATION_CATEGORY = "factor_evaluation"

VALUE_TYPE_FACTOR = "factor"
VALUE_TYPE_DATA_SET = "data_set"
VALUE_TYPE_FACTOR_DATA_CLEAN = "factor_data_clean"
VALUE_TYPE_SCALAR_JSON = "scalar_json"
VALUE_TYPE_SERIES = "series"


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
    """
    Parse ``quantiles`` from StringNodeParam (comma-separated) or legacy persisted JSON.

    Alphalens: one integer = equal-sized bucket count; 2+ floats in [0, 1] = quantile breakpoints.
    """
    if raw is None or isinstance(raw, bool):
        return default
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    if isinstance(raw, (list, tuple)):
        return cast(
            int | tuple[float, ...],
            _int_or_tuple_from_numeric_seq(raw, if_empty=default),
        )
    if isinstance(raw, str):
        return cast(
            int | tuple[float, ...],
            _int_or_tuple_from_csv(raw, if_empty=default),
        )
    return default


def _parse_bins_kwarg(raw: Any) -> int | tuple[float, ...] | None:
    """
    Parse optional ``bins`` from StringNodeParam or legacy scalar_json (int / list).

    Alphalens: int = equal-width bin count; sequence = explicit bin edges. Empty / absent -> None.
    """
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
    default = (1, 5, 10, 20)
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


def _coerce_max_loss_kwarg(raw: Any, *, default: float = 0.5) -> float:
    if raw is None:
        return default
    return float(raw)


def _coerce_filter_zscore_kwarg(raw: Any) -> int | float | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, float) and raw != raw:  # NaN
        return None
    return float(raw) if isinstance(raw, float) else int(raw)


@workflow_node(
    label="计算因子",
    description=(
        "将因子数据、价格数据及分组映射整理为 DataFrame，其 MultiIndex（时间戳、资产）对齐；"
        "返回的数据格式适用于 Alphalens 各函数。"
        "本节点通过 Factor 与数据集加载价格，并调用 get_clean_factor_and_forward_returns。"
    ),
    category=FACTOR_EVALUATION_CATEGORY,
    input_sockets=[
        Socket(
            "factor",
            required=True,
            value_type=VALUE_TYPE_FACTOR,
            label="因子",
        ),
        Socket(
            "data_set",
            required=True,
            value_type=VALUE_TYPE_DATA_SET,
            label="数据集",
        ),
        StringNodeParam(
            "quantiles",
            required=True,
            default="5",
            label="分位数",
            description=(
                "因子分桶：填**单个整数**（如 `5`）表示等样本量的分位个数；填**英文逗号分隔**的 0–1 分位点序列（如 `0, 0.10, 0.5, 0.90, 1.0`）表示非等量桶。"
                "与 `bins` 二选一；`zero_aware` 为 True 时仅支持整数分位个数（Alphalens 限制）。"
            ),
        ),
        StringNodeParam(
            "periods",
            required=False,
            default="1, 5, 10, 20",
            label="持有期",
            description='计算前向收益的持有期序列（整数列表，英文逗号分隔，如 "1, 5, 10, 20"）。',
        ),
        NumberNodeParam(
            "max_loss",
            required=False,
            default=0.5,
            minimum=0,
            maximum=1,
            label="最大缺失率",
            description=(
                "允许丢弃数据占比上限（0.00–1.00）：比较输入因子索引条数与输出 DataFrame 条数。"
                "样本被丢弃可能因为因子本身无效（如 NaN）、价格不足以算全前向收益，或无法完成分桶等。"
                "设为 0 则不再抑制由此引发的异常。"
            ),
        ),
        BooleanNodeParam(
            "binning_by_group",
            required=False,
            default=False,
            label="按组分桶",
            description=(
                "为 True 时在每个分组内单独划分分位桶。当不同分组间因子数值范围差异很大时，"
                "宜在组内相对分桶；若因子面向组中性组合分析，通常应开启。"
            ),
        ),
        Socket(
            "groupby",
            required=False,
            value_type=VALUE_TYPE_SERIES,
            label="分组",
            description=(
                "或为按 (日期, 资产) 索引的 MultiIndex Series，给出各期各标的的组代码；"
                "或为 dict（资产 → 组）。传入 dict 时假定该映射在因子样本整段时期内不变。未连接则为 None。"
            ),
        ),
        StringNodeParam(
            "bins",
            required=False,
            label="自定义分位边界",
            description=(
                '等数值宽度的分箱个数，或显式箱边界序列（如 "-4, -2, -0.5, 0, 10"），按因子取值本身间距划分，'
                "适合离散取值因子。与 quantiles 二选一。未连接则为 None。"
            ),
        ),
        NumberNodeParam(
            "filter_zscore",
            required=False,
            default=None,
            label="Z-score 过滤",
            description=(
                "将偏离均值超过该倍数标准差的前向收益置为 NaN；在 Alphalens 中可设为 None 以关闭过滤。"
                "注意：该异常值过滤会引入前视偏差。"
            ),
        ),
        Socket(
            "groupby_labels",
            required=False,
            value_type=VALUE_TYPE_SCALAR_JSON,
            label="分组标签",
            description="组代码到展示名称的字典；键为 group 编码，值为对应显示名。未连接则为 None。",
        ),
        BooleanNodeParam(
            "zero_aware",
            required=False,
            default=False,
            label="零值感知分桶",
            description="为 True 时，对正信号与负信号分别计算分位桶；适用于信号关于零中心化、且以零区分多空的情形。",
        ),
        BooleanNodeParam(
            "cumulative_returns",
            required=False,
            default=True,
            label="累积收益",
            description="为 True 时前向收益列为累积收益；为 False 时便于分析因子对单一前向步长（如单日）收益的预测能力。",
        ),
        BooleanNodeParam(
            "long_short",
            required=False,
            default=True,
            label="多空组合",
            description="为 True 时在 evaluator 中启用 long-short 相关逻辑。",
        ),
    ],
    output_sockets=[
        Socket(
            "clean_factor",
            value_type=VALUE_TYPE_FACTOR_DATA_CLEAN,
            label="清洗后因子数据",
            description="适用于 Alphalens 的 clean factor DataFrame（MultiIndex: date×asset）。",
        )
    ],
)
class CalculateFactorValueNode:
    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        FactorClass: type[Factor] = kwargs["factor"]
        data_set: DataSet | None = kwargs.get("data_set")
        if data_set is None:
            raise ValueError("数据集不能为空")

        factor = FactorClass(dependency_resolver=data_set.create_resolver())
        end = data_set.end_date
        if not end:
            raise ValueError("数据集未配置评价结束日期，请在数据集中设置结束日期")
        start = data_set.start_date
        ev = AlphalensFactorEvaluator(
            factor,
            start_date=start,
            end_date=end,
            instrument_codes=data_set.instrument_codes,
            long_short=bool(kwargs.get("long_short", True)),
        )
        quantiles = _parse_quantiles_kwarg(kwargs.get("quantiles", "5"))
        periods = _parse_periods_kwarg(kwargs.get("periods", "1, 5, 10, 20"))
        max_loss = _coerce_max_loss_kwarg(kwargs.get("max_loss", 0.5))
        bins = _parse_bins_kwarg(kwargs.get("bins"))
        filter_zscore = _coerce_filter_zscore_kwarg(kwargs.get("filter_zscore"))
        return ev.prepare_factor_data(
            quantiles=quantiles,
            periods=periods,
            max_loss=max_loss,
            groupby=kwargs.get("groupby"),
            binning_by_group=bool(kwargs.get("binning_by_group", False)),
            bins=bins,
            filter_zscore=filter_zscore,
            groupby_labels=kwargs.get("groupby_labels"),
            zero_aware=bool(kwargs.get("zero_aware", False)),
            cumulative_returns=bool(kwargs.get("cumulative_returns", True)),
        )
