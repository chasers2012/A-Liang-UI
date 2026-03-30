"""calculate_factor_value – Alphalens factor_data_clean from Factor + evaluation window."""

from __future__ import annotations

import contextlib
import re
from typing import Any

from evaluate import AlphalensFactorEvaluator
from factor import Factor
from workflow import (
    BooleanNodeParam,
    NumberNodeParam,
    StringNodeParam,
    workflow_node,
    workflow_socket,
)


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
        workflow_socket("factor", required=True, value_type="any"),
        workflow_socket("start_date", required=True, value_type="scalar_json"),
        workflow_socket("end_date", required=True, value_type="scalar_json"),
        workflow_socket("last_quantiles", required=True, value_type="scalar_json"),
        workflow_socket("stock_codes", required=False, value_type="scalar_json"),
    ],
    output_sockets=[
        workflow_socket("clean_factor", value_type="factor_data_clean"),
    ],
    workflow_parameters=[
        StringNodeParam(
            "forward_return_periods",
            label="持有期 periods（逗号分隔）",
            default="1,5,10,20",
        ),
        StringNodeParam(
            "alphalens_quantiles",
            label="分位数（留空则用环境变量 FACTOR_AGENT_QUANTILES，默认 5）",
            default="",
        ),
        BooleanNodeParam(
            "long_short",
            label="多空 long_short",
            default=True,
        ),
        NumberNodeParam(
            "max_loss",
            label="max_loss",
            default=0.5,
            minimum=0.0,
            maximum=10.0,
        ),
    ],
    entry="execute",
)
class CalculateFactorValueNode:
    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        factor: Factor = kwargs["factor"]
        if factor._dependency_resolver is None:
            raise ValueError("factor 须设置 dependency_resolver")

        ev = AlphalensFactorEvaluator(
            factor,
            start_date=kwargs.get("start_date"),
            end_date=str(kwargs["end_date"]),
            stock_codes=kwargs.get("stock_codes"),
            long_short=bool(kwargs.get("long_short", True)),
        )
        return (clean_factor_from_alphalens_evaluator(ev, dict(kwargs)),)
