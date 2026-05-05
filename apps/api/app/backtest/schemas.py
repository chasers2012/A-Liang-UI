from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

BacktestRunStatus = Literal["queued", "running", "success", "failed", "cancelled"]

FromSignalsDirection = Literal["longonly", "shortonly", "both"]
FromSignalsAccumulate = Literal["disabled", "both", "addonly", "removeonly"]
FromSignalsConflictMode = Literal["ignore", "entry", "exit", "adjacent", "opposite"]
FromSignalsOppositeEntryMode = Literal["ignore", "close", "closereduce", "reverse", "reversereduce"]


class BacktestRunSummary(BaseModel):
    id: str
    strategy_id: str
    strategy_name: str | None = None
    data_set_id: str
    data_set_name: str | None = None
    status: BacktestRunStatus
    queued_at: datetime
    start_at: datetime | None = None
    end_at: datetime | None = None
    error: str | None = None


class BacktestRunDetail(BacktestRunSummary):
    # Summary payload for list/detail; charts fetched via dedicated endpoints.
    results: Any = None


class RunBacktestRequest(BaseModel):
    strategy_id: str
    data_set_id: str

    # 回测参数透传容器：参数名和参数值由 /backtests/run/spec 控制
    params: dict[str, Any] = Field(default_factory=dict)


class BacktestRunFormSpecPublic(BaseModel):
    """供前端使用 RJSF 动态渲染回测参数表单。"""

    model_config = ConfigDict(populate_by_name=True)

    json_schema: dict[str, Any] = Field(alias="schema")
    ui_schema: dict[str, Any] = Field(alias="uiSchema")
    default_values: dict[str, Any] = Field(default_factory=dict)


class BacktestEquityResponse(BaseModel):
    run_id: str
    equity_curve: list[dict[str, Any]] = Field(default_factory=list)


class BacktestTradesResponse(BaseModel):
    run_id: str
    trades: list[dict[str, Any]] = Field(default_factory=list)


def _schema_defaults(schema: dict[str, Any]) -> dict[str, Any]:
    props = schema.get("properties")
    if not isinstance(props, dict):
        return {}
    out: dict[str, Any] = {}
    for key, node in props.items():
        if not isinstance(node, dict):
            continue
        if "default" in node:
            out[str(key)] = node["default"]
    return out


def backtest_run_form_spec_public() -> BacktestRunFormSpecPublic:
    from app.data_set.controller import list_data_sets
    from app.strategy.registry import StrategyRegistry

    strategies = StrategyRegistry.list_all()
    data_sets = list_data_sets()
    strategy_one_of = [{"const": s.id, "title": f"{s.name}"} for s in strategies]
    data_set_one_of = [{"const": d.id, "title": f"{d.name}"} for d in data_sets]
    default_strategy_id = strategy_one_of[0]["const"] if strategy_one_of else ""
    default_data_set_id = data_set_one_of[0]["const"] if data_set_one_of else ""

    schema: dict[str, Any] = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "strategy_id": {
                "type": "string",
                "title": "策略",
                "description": "回测使用的策略。",
                "oneOf": strategy_one_of,
                "default": default_strategy_id,
            },
            "data_set_id": {
                "type": "string",
                "title": "数据集",
                "description": "回测使用的数据集。",
                "oneOf": data_set_one_of,
                "default": default_data_set_id,
            },
            "init_cash": {
                "type": "number",
                "title": "初始资金",
                "description": "初始资金。",
                "minimum": 1,
                "default": 1_000_000,
            },
            "fees": {
                "type": "number",
                "title": "手续费率",
                "description": "按订单价值百分比收取的手续费（fees）。",
                "minimum": 0.0,
                "default": 0.0003,
            },
            "slippage": {
                "type": "number",
                "title": "滑点率",
                "description": "按价格百分比计的滑点（slippage）。",
                "minimum": 0.0,
                "default": 0.0,
            },
            "direction": {
                "type": "string",
                "title": "交易方向",
                "oneOf": [
                    {
                        "const": "longonly",
                        "title": "仅多头",
                        "description": "只允许做多开仓与平多。",
                    },
                    {
                        "const": "shortonly",
                        "title": "仅空头",
                        "description": "只允许做空开仓与平空。",
                    },
                    {
                        "const": "both",
                        "title": "双向",
                        "description": "允许多头与空头两种方向。",
                    },
                ],
            },
            "accumulate": {
                "type": "string",
                "title": "仓位累加模式",
                "description": "仓位累加模式。True 等价于 both，False 等价于 disabled。启用后 from_signals 的行为更接近 from_orders。",
                "oneOf": [
                    {
                        "const": "disabled",
                        "title": "禁用累加",
                        "description": "重复信号不增减仓，仅处理开平仓逻辑。",
                    },
                    {
                        "const": "both",
                        "title": "双向累加",
                        "description": "允许加仓与减仓。",
                    },
                    {
                        "const": "addonly",
                        "title": "仅加仓",
                        "description": "仅允许增加仓位，不允许减仓。",
                    },
                    {
                        "const": "removeonly",
                        "title": "仅减仓",
                        "description": "仅允许减少仓位，不允许加仓。",
                    },
                ],
            },
            "allow_partial": {
                "type": "boolean",
                "title": "允许部分成交",
                "description": "是否允许部分成交；当 size 为 np.inf 时不生效。",
            },
            "upon_long_conflict": {
                "type": "string",
                "title": "多头冲突处理",
                "description": "多头入场与出场信号同时出现时的处理模式，可选择忽略、优先入场、优先出场、邻接处理或反向处理。",
                "oneOf": [
                    {"const": "ignore", "title": "忽略", "description": "忽略冲突信号。"},
                    {
                        "const": "entry",
                        "title": "优先入场",
                        "description": "优先执行入场信号。",
                    },
                    {
                        "const": "exit",
                        "title": "优先出场",
                        "description": "优先执行出场信号。",
                    },
                    {
                        "const": "adjacent",
                        "title": "邻接处理",
                        "description": "按邻接规则转换/处理冲突信号。",
                    },
                    {
                        "const": "opposite",
                        "title": "反向处理",
                        "description": "按反向规则处理冲突信号。",
                    },
                ],
            },
            "upon_short_conflict": {
                "type": "string",
                "title": "空头冲突处理",
                "description": "空头入场与出场信号同时出现时的处理模式，可选择忽略、优先入场、优先出场、邻接处理或反向处理。",
                "oneOf": [
                    {"const": "ignore", "title": "忽略", "description": "忽略冲突信号。"},
                    {
                        "const": "entry",
                        "title": "优先入场",
                        "description": "优先执行入场信号。",
                    },
                    {
                        "const": "exit",
                        "title": "优先出场",
                        "description": "优先执行出场信号。",
                    },
                    {
                        "const": "adjacent",
                        "title": "邻接处理",
                        "description": "按邻接规则转换/处理冲突信号。",
                    },
                    {
                        "const": "opposite",
                        "title": "反向处理",
                        "description": "按反向规则处理冲突信号。",
                    },
                ],
            },
            "upon_opposite_entry": {
                "type": "string",
                "title": "反向入场处理",
                "description": "已有持仓时出现反向入场信号的处理模式，可选择忽略、平仓、平仓或减仓、反手、反手或减仓。",
                "oneOf": [
                    {
                        "const": "ignore",
                        "title": "忽略",
                        "description": "忽略反向入场信号。",
                    },
                    {"const": "close", "title": "平仓", "description": "仅平掉当前仓位。"},
                    {
                        "const": "closereduce",
                        "title": "平仓或减仓",
                        "description": "优先减少或平掉当前仓位。",
                    },
                    {
                        "const": "reverse",
                        "title": "反手",
                        "description": "先平仓再开反向仓位。",
                    },
                    {
                        "const": "reversereduce",
                        "title": "反手或减仓",
                        "description": "按可成交量进行反手或减仓处理。",
                    },
                ],
            },
            "upon_dir_conflict": {
                "type": "string",
                "title": "方向冲突处理",
                "description": "同一时点多空方向同时触发时的处理模式，可选择忽略、优先多头、优先空头或同时忽略两者。",
                "oneOf": [
                    {"const": "ignore", "title": "忽略", "description": "忽略冲突信号。"},
                    {
                        "const": "entry",
                        "title": "优先入场",
                        "description": "优先执行入场信号。",
                    },
                    {
                        "const": "exit",
                        "title": "优先出场",
                        "description": "优先执行出场信号。",
                    },
                    {
                        "const": "adjacent",
                        "title": "邻接处理",
                        "description": "按邻接规则转换/处理冲突信号。",
                    },
                    {
                        "const": "opposite",
                        "title": "反向处理",
                        "description": "按反向规则处理冲突信号。",
                    },
                ],
            },
            "size_type": {
                "type": "string",
                "title": "下单数量类型",
                "description": "下单规模解释方式。仅支持 Amount / Value / Percent；Percent 不支持直接反手。",
                "oneOf": [
                    {
                        "const": "amount",
                        "title": "数量",
                        "description": "按标的数量下单。",
                    },
                    {"const": "value", "title": "金额", "description": "按名义金额下单。"},
                    {
                        "const": "percent",
                        "title": "比例",
                        "description": "按可用资金比例下单。",
                    },
                ],
            },
            "size": {
                "type": "number",
                "title": "下单规模",
                "description": "订单规模（size）；在 from_signals 中不允许负值，方向应由信号表达。",
            },
            "price": {
                "type": "number",
                "title": "下单价格",
                "description": "订单价格（price），默认 np.inf。现金共享且 call_seq=auto 时，同组订单应使用同一时间戳价格。",
            },
            "fixed_fees": {
                "type": "number",
                "title": "固定手续费",
                "description": "每笔订单固定手续费金额（fixed_fees）。",
            },
            "min_size": {
                "type": "number",
                "title": "最小下单量",
                "description": "订单可被接受的最小规模（min_size）。",
            },
            "max_size": {
                "type": "number",
                "title": "最大下单量",
                "description": "最大下单规模。超出时会部分成交；若启用累加且该值过小，可能无法正常平仓。",
            },
            "size_granularity": {
                "type": "number",
                "title": "下单粒度",
                "description": "下单规模粒度（size_granularity）。",
            },
            "reject_prob": {
                "type": "number",
                "title": "拒单概率",
                "description": "订单被拒绝的概率（reject_prob）。",
            },
            "lock_cash": {
                "type": "boolean",
                "title": "锁定现金",
                "description": "做空时是否锁定现金（lock_cash）。",
            },
            "raise_reject": {
                "type": "boolean",
                "title": "拒单抛错",
                "description": "订单被拒绝时是否抛出异常（raise_reject）。",
            },
            "log": {
                "type": "boolean",
                "title": "记录日志",
                "description": "是否记录订单日志（log）。",
            },
            "sl_stop": {
                "type": "number",
                "title": "止损比例",
                "description": "止损阈值。多头为低于入场价的百分比、空头为高于入场价的百分比；0.01 表示 1%。",
            },
            "sl_trail": {
                "type": "boolean",
                "title": "追踪止损",
                "description": "是否将 sl_stop 作为追踪止损。",
            },
            "tp_stop": {
                "type": "number",
                "title": "止盈比例",
                "description": "止盈阈值。多头为高于入场价的百分比、空头为低于入场价的百分比；0.01 表示 1%。",
            },
            "stop_entry_price": {
                "type": "string",
                "title": "止损止盈入场参考价",
                "description": "止损/止盈的入场参考价类型。若按元素提供，将在入场时生效。",
                "oneOf": [
                    {
                        "const": "val_price",
                        "title": "估值价",
                        "description": "以估值价格作为参考。",
                    },
                    {
                        "const": "price",
                        "title": "下单价",
                        "description": "以下单价格作为参考。",
                    },
                    {
                        "const": "fill_price",
                        "title": "成交价",
                        "description": "以实际成交价作为参考。",
                    },
                    {
                        "const": "close",
                        "title": "收盘价",
                        "description": "以收盘价作为参考。",
                    },
                ],
            },
            "stop_exit_price": {
                "type": "string",
                "title": "止损止盈出场价格",
                "description": "止损/止盈触发后的出场定价方式。若按元素提供，将在出场时生效。",
                "oneOf": [
                    {
                        "const": "stoplimit",
                        "title": "止损限价",
                        "description": "按止损限价模式出场。",
                    },
                    {
                        "const": "stopmarket",
                        "title": "止损市价",
                        "description": "按止损市价模式出场。",
                    },
                    {"const": "price", "title": "下单价", "description": "以下单价出场。"},
                    {"const": "close", "title": "收盘价", "description": "以收盘价出场。"},
                ],
            },
            "upon_stop_exit": {
                "type": "string",
                "title": "止损止盈出场动作",
                "description": "止损/止盈触发后的处理模式。若按元素提供，将在出场时生效。",
                "oneOf": [
                    {"const": "close", "title": "平仓", "description": "平掉当前仓位。"},
                    {
                        "const": "closereduce",
                        "title": "平仓或减仓",
                        "description": "优先减仓，不足时平仓。",
                    },
                    {
                        "const": "reverse",
                        "title": "反手",
                        "description": "平仓后开反向仓位。",
                    },
                    {
                        "const": "reversereduce",
                        "title": "反手或减仓",
                        "description": "按可成交量进行反手或减仓。",
                    },
                ],
            },
            "upon_stop_update": {
                "type": "string",
                "title": "止损止盈更新策略",
                "description": "重复入场时的止损/止盈更新模式。仅在启用累加时生效。",
                "oneOf": [
                    {"const": "keep", "title": "保持", "description": "保留已有止损止盈。"},
                    {
                        "const": "override",
                        "title": "覆盖",
                        "description": "使用新值覆盖旧值。",
                    },
                    {
                        "const": "overridenan",
                        "title": "仅覆盖非空",
                        "description": "仅当新值非空时才覆盖。",
                    },
                ],
            },
            "use_stops": {
                "type": "boolean",
                "title": "启用止损止盈",
                "description": "是否启用止损逻辑。默认在存在任一止损/止盈或自定义调整函数时自动启用；关闭可提升简单场景速度。",
            },
            "cash_sharing": {
                "type": "boolean",
                "title": "组内共享现金",
                "description": "是否在同一分组内共享现金。若 group_by 为 None 且启用该项，会自动形成单一分组；该模式会引入跨资产依赖。",
                "default": True,
            },
            "group_by": {
                "type": "boolean",
                "title": "按组聚合",
                "description": "列分组方式（group_by），用于定义资金共享与按组统计。",
                "default": True,
            },
            "ffill_val_price": {
                "type": "boolean",
                "title": "估值价前向填充",
                "description": "是否仅在估值价格已知时跟踪；否则未知 close 会导致下一时刻估值价为 NaN。",
            },
            "update_value": {
                "type": "boolean",
                "title": "逐步更新净值",
                "description": "每笔订单成交后是否更新分组价值（update_value）。",
            },
            "seed": {
                "type": "integer",
                "title": "随机种子",
                "description": "用于 call_seq 与仿真起始阶段的随机种子（seed）。",
            },
            "freq": {
                "type": "string",
                "title": "时间频率",
                "description": "当无法从 close 解析时使用的索引频率（freq）。",
            },
        },
        "dependencies": {
            "direction": {
                "oneOf": [
                    {
                        "properties": {
                            "direction": {"const": "longonly"},
                            "upon_short_conflict": False,
                        }
                    },
                    {
                        "properties": {
                            "direction": {"const": "shortonly"},
                            "upon_long_conflict": False,
                        }
                    },
                    {
                        "properties": {
                            "direction": {"const": "both"},
                        }
                    },
                ]
            },
            "upon_opposite_entry": {
                "oneOf": [
                    {
                        "properties": {
                            "direction": {"const": "longonly"},
                            "upon_opposite_entry": {
                                "type": "string",
                                "title": "反向入场处理",
                                "description": "仅单向模式下禁用反手类动作，仅允许忽略/平仓/减仓。",
                                "oneOf": [
                                    {
                                        "const": "ignore",
                                        "title": "忽略",
                                        "description": "忽略反向入场信号。",
                                    },
                                    {
                                        "const": "close",
                                        "title": "平仓",
                                        "description": "仅平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓",
                                        "description": "优先减少或平掉当前仓位。",
                                    },
                                ],
                            },
                        }
                    },
                    {
                        "properties": {
                            "direction": {"const": "shortonly"},
                            "upon_opposite_entry": {
                                "type": "string",
                                "title": "反向入场处理",
                                "description": "仅单向模式下禁用反手类动作，仅允许忽略/平仓/减仓。",
                                "oneOf": [
                                    {
                                        "const": "ignore",
                                        "title": "忽略",
                                        "description": "忽略反向入场信号。",
                                    },
                                    {
                                        "const": "close",
                                        "title": "平仓",
                                        "description": "仅平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓",
                                        "description": "优先减少或平掉当前仓位。",
                                    },
                                ],
                            },
                        }
                    },
                    {
                        "properties": {
                            "direction": {"const": "both"},
                        }
                    },
                ]
            },
            "upon_stop_exit": {
                "oneOf": [
                    {
                        "properties": {
                            "direction": {"const": "longonly"},
                            "upon_stop_exit": {
                                "type": "string",
                                "title": "止损止盈出场动作",
                                "description": "仅单向模式下禁用反手类动作，仅允许平仓/减仓。",
                                "oneOf": [
                                    {
                                        "const": "close",
                                        "title": "平仓",
                                        "description": "平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓",
                                        "description": "优先减仓，不足时平仓。",
                                    },
                                ],
                            },
                        }
                    },
                    {
                        "properties": {
                            "direction": {"const": "shortonly"},
                            "upon_stop_exit": {
                                "type": "string",
                                "title": "止损止盈出场动作",
                                "description": "仅单向模式下禁用反手类动作，仅允许平仓/减仓。",
                                "oneOf": [
                                    {
                                        "const": "close",
                                        "title": "平仓",
                                        "description": "平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓",
                                        "description": "优先减仓，不足时平仓。",
                                    },
                                ],
                            },
                        }
                    },
                    {
                        "properties": {
                            "direction": {"const": "both"},
                        }
                    },
                ]
            },
        },
        "required": ["strategy_id", "data_set_id", "init_cash", "fees", "slippage"],
    }

    ui_schema: dict[str, Any] = {
        "navConf": {
            "order": [
                "basic",
                "position_pricing",
                "conflict_rules",
                "stops",
                "execution_valuation",
            ],
            "navs": [
                {"nav": "basic", "name": "基础"},
                {"nav": "position_pricing", "name": "仓位与价格"},
                {"nav": "conflict_rules", "name": "冲突处理"},
                {"nav": "stops", "name": "止损止盈"},
                {"nav": "execution_valuation", "name": "执行与估值"},
            ],
        },
        "ui:submitButtonOptions": {"norender": True},
        "strategy_id": {"nav": "basic"},
        "data_set_id": {"nav": "basic"},
        "init_cash": {"nav": "basic"},
        "fees": {"nav": "basic"},
        "slippage": {"nav": "basic"},
        "freq": {"nav": "basic"},
        "direction": {"nav": "basic"},
        "size_type": {"nav": "position_pricing"},
        "accumulate": {"nav": "position_pricing"},
        "size": {"nav": "position_pricing"},
        "price": {"nav": "position_pricing"},
        "min_size": {"nav": "position_pricing"},
        "max_size": {"nav": "position_pricing"},
        "size_granularity": {"nav": "position_pricing"},
        "fixed_fees": {"nav": "basic"},
        "upon_long_conflict": {"nav": "conflict_rules"},
        "upon_short_conflict": {"nav": "conflict_rules"},
        "upon_dir_conflict": {"nav": "conflict_rules"},
        "upon_opposite_entry": {"nav": "conflict_rules"},
        "allow_partial": {"nav": "conflict_rules"},
        "raise_reject": {"nav": "conflict_rules"},
        "reject_prob": {"nav": "conflict_rules"},
        "lock_cash": {"nav": "conflict_rules"},
        "sl_stop": {"nav": "stops"},
        "sl_trail": {"nav": "stops"},
        "tp_stop": {"nav": "stops"},
        "stop_entry_price": {"nav": "stops"},
        "stop_exit_price": {"nav": "stops"},
        "upon_stop_exit": {"nav": "stops"},
        "upon_stop_update": {"nav": "stops"},
        "use_stops": {"nav": "stops"},
        "open": {"nav": "execution_valuation"},
        "high": {"nav": "execution_valuation"},
        "low": {"nav": "execution_valuation"},
        "val_price": {"nav": "execution_valuation"},
        "ffill_val_price": {"nav": "execution_valuation"},
        "update_value": {"nav": "execution_valuation"},
        "cash_sharing": {"nav": "execution_valuation"},
        "group_by": {"nav": "execution_valuation"},
        "log": {"nav": "execution_valuation"},
        "seed": {"nav": "execution_valuation"},
    }

    default_values = _schema_defaults(schema)

    return BacktestRunFormSpecPublic(
        schema=schema, uiSchema=ui_schema, default_values=default_values
    )
