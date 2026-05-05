from __future__ import annotations

import json
from typing import Any

# 策略工作流节点在节点可见性注册表中的 domain id。
WORKFLOW_STRATEGY_DOMAIN: str = "strategy"

STRATEGY_WORKFLOW_INPUTS: list[dict[str, Any]] = [
    {
        "name": "data_set_id",
        "required": True,
        "label": "数据集ID",
        "description": "策略计算与回测使用的数据集 ID",
        "value_type": "string",
        "render_type": "socket",
    },
]

STRATEGY_WORKFLOW_OUTPUTS: list[dict[str, Any]] = [
    {
        "name": "entries",
        "required": True,
        "label": "开仓信号",
        "description": (
            "宽表布尔矩阵，表示每个时间点/资产是否触发开仓。\n"
            "\n"
            "示例：\n"
            "\n"
            "| date       | AAPL  | MSFT |\n"
            "|------------|-------|------|\n"
            "| 2026-04-01 | True  | False|\n"
            "| 2026-04-02 | False | True |\n"
        ),
        "value_type": "dataframe",
        "render_type": "socket",
    },
    {
        "name": "exits",
        "required": True,
        "label": "平仓信号",
        "description": (
            "宽表布尔矩阵，表示每个时间点/资产是否触发平仓。\n"
            "\n"
            "示例：\n"
            "\n"
            "| date       | AAPL  | MSFT |\n"
            "|------------|-------|------|\n"
            "| 2026-04-01 | False | False|\n"
            "| 2026-04-02 | True  | False|\n"
        ),
        "value_type": "dataframe",
        "render_type": "socket",
    },
    # Optional dataframe outputs used by vectorbt `from_signals` advanced params.
    *[
        {
            "name": name,
            "required": False,
            "label": label,
            "description": f"可选：用于 from_signals 参数 `{name}` 的宽表输出。",
            "value_type": "dataframe",
            "render_type": "socket",
        }
        for name, label in [
            ("short_entries", "做空开仓信号"),
            ("short_exits", "做空平仓信号"),
            ("size", "下单规模"),
            ("price", "下单价格"),
            ("fees", "手续费"),
            ("fixed_fees", "固定手续费"),
            ("slippage", "滑点"),
            ("min_size", "最小下单规模"),
            ("max_size", "最大下单规模"),
            ("size_granularity", "下单粒度"),
            ("reject_prob", "拒单概率"),
            ("lock_cash", "锁定现金"),
            ("allow_partial", "允许部分成交"),
            ("raise_reject", "拒单时抛错"),
            ("log", "交易日志开关"),
            ("val_price", "估值价格"),
            ("open", "开盘价"),
            ("high", "最高价"),
            ("low", "最低价"),
            ("sl_stop", "止损比例"),
            ("sl_trail", "移动止损开关"),
            ("tp_stop", "止盈比例"),
        ]
    ],
]

STRATEGY_EMPTY_WORKFLOW_TEMPLATE: dict[str, Any] = {
    "nodes": [],
    "links": [],
    "workflow_inputs": STRATEGY_WORKFLOW_INPUTS,
    "workflow_outputs": STRATEGY_WORKFLOW_OUTPUTS,
}


def _deep_copy_json_object(value: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(value, ensure_ascii=False))


def empty_workflow_template_dict() -> dict[str, Any]:
    return _deep_copy_json_object(STRATEGY_EMPTY_WORKFLOW_TEMPLATE)


def strategy_workflow_template_dict() -> dict[str, Any]:
    return empty_workflow_template_dict()


def strategy_workflow_io_spec_dict() -> dict[str, list[dict[str, Any]]]:
    return {
        "workflow_inputs": _deep_copy_json_object({"workflow_inputs": STRATEGY_WORKFLOW_INPUTS})[
            "workflow_inputs"
        ],
        "workflow_outputs": _deep_copy_json_object({"workflow_outputs": STRATEGY_WORKFLOW_OUTPUTS})[
            "workflow_outputs"
        ],
    }
