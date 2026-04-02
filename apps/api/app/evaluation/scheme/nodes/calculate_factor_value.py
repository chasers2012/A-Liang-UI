"""calculate_factor_value – Alphalens factor_data_clean from Factor + evaluation window."""

from __future__ import annotations

import contextlib
import re
from typing import Any

from evaluate import AlphalensFactorEvaluator
from evaluate.data_set import DataSet
from factor import Factor
from workflow import (
    NumberNodeParam,
    Socket,
    StringNodeParam,
    workflow_node,
)
from workflow.node_types import DateNodeParam


def forward_periods_tuple(raw: Any) -> tuple[int, ...]:
    if isinstance(raw, list):
        out = tuple(int(float(x)) for x in raw)
        if not out:
            return 1, 5, 10, 20
        return out
    s = str(raw).strip() if raw is not None and raw != "" else "1,5,10,20"
    parts = [p.strip() for p in re.split(r"[,，\s]+", s) if p.strip()]
    if not parts:
        return 1, 5, 10, 20
    return tuple(int(float(x)) for x in parts)


def clean_factor_from_alphalens_evaluator(
    ev: AlphalensFactorEvaluator,
    kwargs: dict[str, Any],
) -> Any:
    last_quantiles: int = int(kwargs["last_quantiles"])
    periods = forward_periods_tuple(kwargs.get("forward_return_periods"))

    q_raw = kwargs.get("alphalens_quantiles", kwargs.get("quantiles"))
    if isinstance(q_raw, (int, float)) and not isinstance(q_raw, bool):
        last_quantiles = max(2, int(q_raw))
    elif q_raw is not None and str(q_raw).strip() != "":
        with contextlib.suppress(TypeError, ValueError):
            last_quantiles = max(2, int(float(str(q_raw).strip())))

    ls = bool(kwargs.get("long_short", True))
    try:
        ml = float(kwargs.get("max_loss", 0.5))
    except (TypeError, ValueError):
        ml = 0.5
    ev.long_short = ls

    out = ev.evaluate_factor(
        quantiles=last_quantiles,
        periods=periods,
        max_loss=ml,
    )
    return out.factor_data_clean


@workflow_node(
    label="计算因子",
    description="根据 Factor 实例与评价窗口计算 factor_data_clean；持有期、分位数等请在节点参数中配置",
    category="factor_evaluation",
    input_sockets=[
        Socket("factor", required=True, value_type="any", label="因子"),
        Socket("data_set", required=True, value_type="data_set", label="数据集"),
        DateNodeParam("start_date", required=True, label="开始日期"),
        DateNodeParam("end_date", required=True, label="结束日期"),
        NumberNodeParam("quantiles", required=True, default=5, label="分位数"),
        StringNodeParam("stock_codes", required=False, default="", label="股票代码"),
    ],
    output_sockets=[
        Socket("clean_factor", value_type="factor_data_clean"),
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
        return clean_factor_from_alphalens_evaluator(ev, dict(kwargs))
