"""prepare_alphalens – computes factor_data_clean from factor + data source."""

from __future__ import annotations

import contextlib
import re
from collections.abc import Mapping
from typing import Any

from evaluate.alphalens_panel_utils import stock_count_from_alignment
from workflow import (
    BooleanNodeParam,
    NumberNodeParam,
    StringNodeParam,
    WorkflowNode,
    workflow_node,
    workflow_socket,
)


def _forward_periods_tuple(raw: Any) -> tuple[int, ...]:
    if isinstance(raw, list):
        out = tuple(int(float(x)) for x in raw)
        return out if out else (1, 5, 10, 20)
    s = str(raw).strip() if raw is not None and raw != "" else "1,5,10,20"
    parts = [p.strip() for p in re.split(r"[,，\s]+", s) if p.strip()]
    if not parts:
        return (1, 5, 10, 20)
    return tuple(int(float(x)) for x in parts)


@workflow_node(
    label="计算因子",
    description="根据因子与数据源计算 factor_data_clean；持有期、分位数等请在节点参数中配置",
    input_sockets=[
        workflow_socket("ev", required=True, value_type="any"),
        workflow_socket("last_quantiles", required=True, value_type="scalar_json"),
    ],
    output_sockets=[
        workflow_socket("clean_factor", value_type="factor_data_clean"),
        workflow_socket("last_quantiles", value_type="scalar_json"),
        workflow_socket("n_stocks", value_type="scalar_json"),
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
class PrepareAlphalensNode:
    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
    ) -> dict[str, Any]:
        nid = node.id
        ev = inputs["ev"]
        last_quantiles: int = inputs["last_quantiles"]
        params = dict(node.params or {})
        periods = _forward_periods_tuple(params.get("forward_return_periods"))

        q_raw = params.get("alphalens_quantiles", params.get("quantiles"))
        if isinstance(q_raw, (int, float)) and not isinstance(q_raw, bool):
            last_quantiles = max(2, int(q_raw))
        elif q_raw is not None and str(q_raw).strip() != "":
            with contextlib.suppress(TypeError, ValueError):
                last_quantiles = max(2, int(float(str(q_raw).strip())))

        ls = bool(params.get("long_short", True))
        try:
            ml = float(params.get("max_loss", 0.5))
        except (TypeError, ValueError):
            ml = 0.5
        ev.long_short = ls

        out = ev.evaluate_factor(
            quantiles=last_quantiles,
            periods=periods,
            max_loss=ml,
        )
        n_stocks = stock_count_from_alignment(ev.alignment_index())
        _ = nid
        return {
            "clean_factor": out.factor_data_clean,
            "last_quantiles": last_quantiles,
            "n_stocks": n_stocks,
        }
