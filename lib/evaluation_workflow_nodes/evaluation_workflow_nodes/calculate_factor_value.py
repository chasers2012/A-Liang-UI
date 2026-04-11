"""计算因子节点：封装 get_clean_factor_and_forward_returns（经 prepare_factor_data）。"""

from __future__ import annotations

from typing import Any

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

from evaluation_workflow_nodes.constants import (
    FACTOR_EVALUATION_CATEGORY,
    VALUE_TYPE_DATA_SET,
    VALUE_TYPE_FACTOR,
    VALUE_TYPE_FACTOR_DATA_CLEAN,
    VALUE_TYPE_SCALAR_JSON,
)


@workflow_node(
    label="计算因子",
    description=(
        "将因子数据、价格数据及（可选）分组映射整理为 MultiIndex（时间戳、资产）对齐的 DataFrame，"
        "格式适用于 Alphalens 各函数。输出包含因子值、各持有期前向收益、因子分位，以及可选的 group 列。"
        "若数据已完全符合 get_clean_factor_and_forward_returns 的约定，也可跳过等价步骤直接接入 Alphalens。"
        "本节点通过 Factor 与数据集加载价格，并调用 get_clean_factor_and_forward_returns（经 prepare_factor_data）。"
    ),
    category=FACTOR_EVALUATION_CATEGORY,
    input_sockets=[
        Socket(
            "factor",
            required=True,
            value_type=VALUE_TYPE_FACTOR,
            label="因子",
            description=(
                "对应 Alphalens 的 factor：双层索引 Series，第 0 层为时间戳、第 1 层为资产代码，"
                "值为单一 alpha 因子。本节点输入为 Factor 类，运行时在数据集区间与标的上调用 calculate 生成上述序列。"
            ),
        ),
        Socket(
            "data_set",
            required=True,
            value_type=VALUE_TYPE_DATA_SET,
            label="数据集",
            description=(
                "提供评价区间、标的范围及依赖解析，以构造 Alphalens 所需的 prices。"
                "prices 须为宽表 DataFrame：行为日期、列为资产；须覆盖因子涉及的时间段，且在每个 (日期, 资产) 之后"
                "仍有不少于 periods 中最大持有期数的行情，用于计算前向收益。"
                "各 (日期, 资产) 上的价格应对应于因子可交易时刻（一般为因子可得后的下一有效价；若延迟交易则对应该成交时刻价），"
                "以避免前视偏差或收益滞后。评价区间与标的列表在本数据集上配置。"
            ),
        ),
        NumberNodeParam(
            "quantiles",
            required=True,
            default=5,
            label="分位数",
            description=(
                "因子分桶用的等样本量分位个数；亦可由分位点序列定义非等量桶（如 [0, .10, .5, .90, 1.] 或 [.05, .5, .95]）。"
                "quantiles 与 bins 二者只能其一非空（本节点以数字参数传入整数分位个数）。"
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
            value_type=VALUE_TYPE_SCALAR_JSON,
            label="分组",
            description=(
                "或为按 (日期, 资产) 索引的 MultiIndex Series，给出各期各标的的组代码；"
                "或为 dict（资产 → 组）。传入 dict 时假定该映射在因子样本整段时期内不变。未连接则为 None。"
            ),
        ),
        Socket(
            "bins",
            required=False,
            value_type=VALUE_TYPE_SCALAR_JSON,
            label="自定义分位边界",
            description=(
                "等数值宽度的分箱个数，或显式箱边界序列（如 [-4, -2, -0.5, 0, 10]），按因子取值本身间距划分，"
                "适合离散取值因子。与 quantiles 二选一。未连接则为 None。"
            ),
        ),
        NumberNodeParam(
            "filter_zscore",
            required=False,
            default=20,
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
            description=(
                "为 True 时，对正信号与负信号分别计算分位桶；适用于信号关于零中心化、且以零区分多空的情形。"
            ),
        ),
        BooleanNodeParam(
            "cumulative_returns",
            required=False,
            default=True,
            label="累积收益",
            description=(
                "为 True 时前向收益列为累积收益；为 False 时便于分析因子对单一前向步长（如单日）收益的预测能力。"
            ),
        ),
    ],
    output_sockets=[
        Socket(
            "clean_factor",
            value_type=VALUE_TYPE_FACTOR_DATA_CLEAN,
            label="清洗后因子数据",
            description=(
                "MultiIndex（日期、资产），含各持有期前向收益列（列名符合 pandas Timedelta 可解析格式，如 1D、5D、10D 等）、"
                "factor、factor_quantile；若曾传入 groupby 则含 group。"
                "结构示意（示例数据来自 Alphalens 文档；前向收益列名随 periods 变化，无 groupby 时无 group 列）：\n\n"
                "| date | asset | 1D | 5D | 10D | factor | group | factor_quantile |\n"
                "|------|-------|-----|-----|-----|--------|-------|-----------------|\n"
                "| 2014-01-01 | AAPL | 0.09 | -0.01 | -0.079 | 0.5 | G1 | 3 |\n"
                "| 2014-01-01 | BA | 0.02 | 0.06 | 0.020 | -1.1 | G2 | 5 |\n"
                "| 2014-01-01 | CMG | 0.03 | 0.09 | 0.036 | 1.7 | G2 | 1 |\n"
                "| 2014-01-01 | DAL | -0.02 | -0.06 | -0.029 | -0.1 | G3 | 5 |\n"
                "| 2014-01-01 | LULU | -0.03 | 0.05 | -0.009 | 2.7 | G1 | 2 |\n\n"
                "日期索引 freq 会按输入推断为交易日历（pandas DateOffset），主要用于累积收益计算。"
            ),
        ),
        Socket(
            "quantiles",
            value_type="number",
            label="分位数",
            description=(
                "本次用于因子分桶的 quantiles 参数（整数），与输入一致，可传给下游分位或绩效相关节点。"
            ),
        ),
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
        quantiles_n = int(kwargs.get("quantiles", 5))
        periods_raw = kwargs.get("periods", "1, 5, 10, 20")
        if isinstance(periods_raw, (list, tuple)):
            periods = tuple(int(p) for p in periods_raw)
        elif isinstance(periods_raw, str):
            parts = [p.strip() for p in periods_raw.split(",") if p.strip()]
            periods = tuple(int(p) for p in parts) if parts else (1, 5, 10, 20)
        else:
            periods = (1, 5, 10, 20)
        max_loss = float(kwargs.get("max_loss", 0.5))
        clean = ev.prepare_factor_data(
            quantiles=quantiles_n,
            periods=periods,
            max_loss=max_loss,
            groupby=kwargs.get("groupby"),
            binning_by_group=bool(kwargs.get("binning_by_group", False)),
            bins=kwargs.get("bins"),
            filter_zscore=kwargs.get("filter_zscore", 20),
            groupby_labels=kwargs.get("groupby_labels"),
            zero_aware=bool(kwargs.get("zero_aware", False)),
            cumulative_returns=bool(kwargs.get("cumulative_returns", True)),
        )
        return clean, quantiles_n
