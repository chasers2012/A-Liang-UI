"""calculate_factor_value – Alphalens factor_data_clean from Factor + evaluation window."""

from __future__ import annotations

from typing import Any

from evaluate import AlphalensFactorEvaluator
from factor import Factor
from factor.data_set import DataSet
from workflow import (
    NumberNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)
from workflow.node_types import DateNodeParam


@workflow_node(
    label="计算因子",
    description="根据 Factor 实例与评价窗口计算 factor_data_clean；持有期、分位数等请在节点参数中配置",
    category="factor_evaluation",
    input_sockets=[
        Socket(
            "data_set",
            required=True,
            value_type="data_set",
            label="数据集",
            description="计算节点使用的数据集",
        ),
        DateNodeParam("start_date", required=True, label="开始日期"),
        DateNodeParam("end_date", required=True, label="结束日期", description="评价区间结束日期"),
        NumberNodeParam(
            "quantiles",
            required=True,
            default=5,
            label="分位数",
            description="将因子分组的分位桶数量",
        ),
        StringNodeParam(
            "stock_codes",
            required=False,
            default="",
            label="股票代码",
            description="可选，逗号分隔；为空表示全市场",
        ),
    ],
    output_sockets=[
        Socket(
            "clean_factor",
            value_type="factor_data_clean",
            label="清洗后因子数据",
            description="Alphalens 可直接消费的 factor_data_clean 数据",
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
        ev = AlphalensFactorEvaluator(
            factor,
            start_date=kwargs.get("start_date"),
            end_date=str(kwargs["end_date"]),
            stock_codes=kwargs.get("stock_codes"),
            long_short=bool(kwargs.get("long_short", True)),
        )
        quantiles = kwargs.get("quantiles", 5)
        periods = kwargs.get("periods", (1, 5, 10, 20))
        max_loss = kwargs.get("max_loss", 0.5)
        return ev.prepare_factor_data(quantiles=quantiles, periods=periods, max_loss=max_loss)
