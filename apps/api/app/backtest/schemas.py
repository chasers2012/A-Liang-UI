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

    # Optional overrides
    start: str | None = None
    end: str | None = None

    initial_cash: float = Field(gt=0)
    fees: float = Field(ge=0)
    slippage: float = Field(ge=0)
    signal_lag: int = 1
    execution_price: Literal["close", "open"] = "close"

    # vectorbt.Portfolio.from_signals 参数（常用子集）
    direction: FromSignalsDirection = "longonly"
    accumulate: FromSignalsAccumulate = "disabled"
    allow_partial: bool = True
    upon_long_conflict: FromSignalsConflictMode = "ignore"
    upon_short_conflict: FromSignalsConflictMode = "ignore"
    upon_opposite_entry: FromSignalsOppositeEntryMode = "ignore"
    upon_dir_conflict: FromSignalsConflictMode = "ignore"
    size_type: Literal["amount", "value", "percent"] = "percent"

    # 其他 from_signals 参数（标量形态）
    size: float | None = None
    price: float | None = None
    fixed_fees: float | None = None
    min_size: float | None = None
    max_size: float | None = None
    size_granularity: float | None = None
    reject_prob: float | None = None
    lock_cash: bool | None = None
    raise_reject: bool | None = None
    log: bool | None = None
    val_price: float | None = None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    sl_stop: float | None = None
    sl_trail: bool | None = None
    tp_stop: float | None = None
    stop_entry_price: Literal["val_price", "price", "fill_price", "close"] | None = None
    stop_exit_price: Literal["stoplimit", "stopmarket", "price", "close"] | None = None
    upon_stop_exit: Literal["close", "closereduce", "reverse", "reversereduce"] | None = None
    upon_stop_update: Literal["keep", "override", "overridenan"] | None = None
    use_stops: bool | None = None
    cash_sharing: bool = True
    group_by: bool = True
    ffill_val_price: bool | None = None
    update_value: bool | None = None
    seed: int | None = None
    freq: str = "1D"


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


def backtest_run_form_spec_public() -> BacktestRunFormSpecPublic:
    # 注意：strategy_id / data_set_id 由前端目录选择器负责，这里仅渲染“参数部分”。
    schema: dict[str, Any] = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "initial_cash": {
                "type": "number",
                "title": "初始资金",
                "description": "组合起始现金（init_cash），必须大于 0。",
                "minimum": 1e-12,
            },
            "fees": {
                "type": "number",
                "title": "手续费率",
                "description": "成交比例手续费（fees），如 0.001 表示千分之一。",
                "minimum": 0.0,
            },
            "slippage": {
                "type": "number",
                "title": "滑点率",
                "description": "成交滑点比例（slippage），用于模拟买卖价偏移。",
                "minimum": 0.0,
            },
            "direction": {
                "type": "string",
                "title": "交易方向",
                "oneOf": [
                    {
                        "const": "longonly",
                        "title": "仅多头（longonly）",
                        "description": "只允许做多开仓与平多。",
                    },
                    {
                        "const": "shortonly",
                        "title": "仅空头（shortonly）",
                        "description": "只允许做空开仓与平空。",
                    },
                    {
                        "const": "both",
                        "title": "双向（both）",
                        "description": "允许多头与空头两种方向。",
                    },
                ],
            },
            "accumulate": {
                "type": "string",
                "title": "仓位累加模式",
                "description": "控制同向信号是否可加减仓。",
                "oneOf": [
                    {
                        "const": "disabled",
                        "title": "禁用累加（disabled）",
                        "description": "重复信号不增减仓，仅处理开平仓逻辑。",
                    },
                    {
                        "const": "both",
                        "title": "双向累加（both）",
                        "description": "允许加仓与减仓。",
                    },
                    {
                        "const": "addonly",
                        "title": "仅加仓（addonly）",
                        "description": "仅允许增加仓位，不允许减仓。",
                    },
                    {
                        "const": "removeonly",
                        "title": "仅减仓（removeonly）",
                        "description": "仅允许减少仓位，不允许加仓。",
                    },
                ],
            },
            "allow_partial": {
                "type": "boolean",
                "title": "允许部分成交",
                "description": "资金不足或受约束时，是否允许部分成交。",
            },
            "upon_long_conflict": {
                "type": "string",
                "title": "多头冲突处理",
                "description": "同一时间多头入场/出场信号冲突时的处理方式。",
                "oneOf": [
                    {"const": "ignore", "title": "忽略（ignore）", "description": "忽略冲突信号。"},
                    {
                        "const": "entry",
                        "title": "优先入场（entry）",
                        "description": "优先执行入场信号。",
                    },
                    {
                        "const": "exit",
                        "title": "优先出场（exit）",
                        "description": "优先执行出场信号。",
                    },
                    {
                        "const": "adjacent",
                        "title": "邻接处理（adjacent）",
                        "description": "按邻接规则转换/处理冲突信号。",
                    },
                    {
                        "const": "opposite",
                        "title": "反向处理（opposite）",
                        "description": "按反向规则处理冲突信号。",
                    },
                ],
            },
            "upon_short_conflict": {
                "type": "string",
                "title": "空头冲突处理",
                "description": "同一时间空头入场/出场信号冲突时的处理方式。",
                "oneOf": [
                    {"const": "ignore", "title": "忽略（ignore）", "description": "忽略冲突信号。"},
                    {
                        "const": "entry",
                        "title": "优先入场（entry）",
                        "description": "优先执行入场信号。",
                    },
                    {
                        "const": "exit",
                        "title": "优先出场（exit）",
                        "description": "优先执行出场信号。",
                    },
                    {
                        "const": "adjacent",
                        "title": "邻接处理（adjacent）",
                        "description": "按邻接规则转换/处理冲突信号。",
                    },
                    {
                        "const": "opposite",
                        "title": "反向处理（opposite）",
                        "description": "按反向规则处理冲突信号。",
                    },
                ],
            },
            "upon_opposite_entry": {
                "type": "string",
                "title": "反向入场处理",
                "description": "已有持仓时出现反向入场信号的处理方式。",
                "oneOf": [
                    {
                        "const": "ignore",
                        "title": "忽略（ignore）",
                        "description": "忽略反向入场信号。",
                    },
                    {"const": "close", "title": "平仓（close）", "description": "仅平掉当前仓位。"},
                    {
                        "const": "closereduce",
                        "title": "平仓或减仓（closereduce）",
                        "description": "优先减少或平掉当前仓位。",
                    },
                    {
                        "const": "reverse",
                        "title": "反手（reverse）",
                        "description": "先平仓再开反向仓位。",
                    },
                    {
                        "const": "reversereduce",
                        "title": "反手或减仓（reversereduce）",
                        "description": "按可成交量进行反手或减仓处理。",
                    },
                ],
            },
            "upon_dir_conflict": {
                "type": "string",
                "title": "方向冲突处理",
                "description": "当方向规则与信号规则冲突时的处理方式。",
                "oneOf": [
                    {"const": "ignore", "title": "忽略（ignore）", "description": "忽略冲突信号。"},
                    {
                        "const": "entry",
                        "title": "优先入场（entry）",
                        "description": "优先执行入场信号。",
                    },
                    {
                        "const": "exit",
                        "title": "优先出场（exit）",
                        "description": "优先执行出场信号。",
                    },
                    {
                        "const": "adjacent",
                        "title": "邻接处理（adjacent）",
                        "description": "按邻接规则转换/处理冲突信号。",
                    },
                    {
                        "const": "opposite",
                        "title": "反向处理（opposite）",
                        "description": "按反向规则处理冲突信号。",
                    },
                ],
            },
            "size_type": {
                "type": "string",
                "title": "下单数量类型",
                "description": "size 的解释方式。",
                "oneOf": [
                    {
                        "const": "amount",
                        "title": "数量（amount）",
                        "description": "按标的数量下单。",
                    },
                    {"const": "value", "title": "金额（value）", "description": "按名义金额下单。"},
                    {
                        "const": "percent",
                        "title": "比例（percent）",
                        "description": "按可用资金比例下单。",
                    },
                ],
            },
            "size": {
                "type": "number",
                "title": "下单规模",
                "description": "与 size_type 联动：数量/金额/比例。",
            },
            "price": {
                "type": "number",
                "title": "下单价格",
                "description": "订单使用的价格；留空时按引擎默认价格。",
            },
            "fixed_fees": {
                "type": "number",
                "title": "固定手续费",
                "description": "每笔订单固定手续费（绝对值）。",
            },
            "min_size": {
                "type": "number",
                "title": "最小下单量",
                "description": "小于该阈值的订单会被拒绝或忽略。",
            },
            "max_size": {
                "type": "number",
                "title": "最大下单量",
                "description": "单笔订单允许的最大规模。",
            },
            "size_granularity": {
                "type": "number",
                "title": "下单粒度",
                "description": "下单量按该步长离散化（如最小交易单位）。",
            },
            "reject_prob": {
                "type": "number",
                "title": "拒单概率",
                "description": "模拟订单被随机拒绝的概率（0~1）。",
            },
            "lock_cash": {
                "type": "boolean",
                "title": "锁定现金",
                "description": "订单挂起后是否预留/锁定现金，避免重复占用。",
            },
            "raise_reject": {
                "type": "boolean",
                "title": "拒单抛错",
                "description": "订单被拒绝时是否抛出异常中断。",
            },
            "log": {
                "type": "boolean",
                "title": "记录日志",
                "description": "开启后记录订单处理日志，便于排查但更慢。",
            },
            "val_price": {
                "type": "number",
                "title": "估值价格",
                "description": "用于估值/计算组合价值的价格。",
            },
            "open": {
                "type": "number",
                "title": "开盘价",
                "description": "K 线开盘价（用于价格上下文，如止损止盈）。",
            },
            "high": {
                "type": "number",
                "title": "最高价",
                "description": "K 线最高价（用于价格上下文，如止损止盈）。",
            },
            "low": {
                "type": "number",
                "title": "最低价",
                "description": "K 线最低价（用于价格上下文，如止损止盈）。",
            },
            "sl_stop": {
                "type": "number",
                "title": "止损比例",
                "description": "止损触发阈值，通常为相对比例。",
            },
            "sl_trail": {
                "type": "boolean",
                "title": "追踪止损",
                "description": "是否使用追踪止损（随价格有利变动而抬升/下移）。",
            },
            "tp_stop": {
                "type": "number",
                "title": "止盈比例",
                "description": "止盈触发阈值，通常为相对比例。",
            },
            "stop_entry_price": {
                "type": "string",
                "title": "止损止盈入场参考价",
                "description": "用于计算止损/止盈锚点的入场参考价格。",
                "oneOf": [
                    {
                        "const": "val_price",
                        "title": "估值价（val_price）",
                        "description": "以估值价格作为参考。",
                    },
                    {
                        "const": "price",
                        "title": "下单价（price）",
                        "description": "以下单价格作为参考。",
                    },
                    {
                        "const": "fill_price",
                        "title": "成交价（fill_price）",
                        "description": "以实际成交价作为参考。",
                    },
                    {
                        "const": "close",
                        "title": "收盘价（close）",
                        "description": "以收盘价作为参考。",
                    },
                ],
            },
            "stop_exit_price": {
                "type": "string",
                "title": "止损止盈出场价格",
                "description": "止损/止盈触发后使用的出场定价方式。",
                "oneOf": [
                    {
                        "const": "stoplimit",
                        "title": "止损限价（stoplimit）",
                        "description": "按止损限价模式出场。",
                    },
                    {
                        "const": "stopmarket",
                        "title": "止损市价（stopmarket）",
                        "description": "按止损市价模式出场。",
                    },
                    {"const": "price", "title": "下单价（price）", "description": "以下单价出场。"},
                    {"const": "close", "title": "收盘价（close）", "description": "以收盘价出场。"},
                ],
            },
            "upon_stop_exit": {
                "type": "string",
                "title": "止损止盈出场动作",
                "description": "止损/止盈触发后的仓位处理动作。",
                "oneOf": [
                    {"const": "close", "title": "平仓（close）", "description": "平掉当前仓位。"},
                    {
                        "const": "closereduce",
                        "title": "平仓或减仓（closereduce）",
                        "description": "优先减仓，不足时平仓。",
                    },
                    {
                        "const": "reverse",
                        "title": "反手（reverse）",
                        "description": "平仓后开反向仓位。",
                    },
                    {
                        "const": "reversereduce",
                        "title": "反手或减仓（reversereduce）",
                        "description": "按可成交量进行反手或减仓。",
                    },
                ],
            },
            "upon_stop_update": {
                "type": "string",
                "title": "止损止盈更新策略",
                "description": "新信号出现时如何更新已有止损/止盈设置。",
                "oneOf": [
                    {"const": "keep", "title": "保持（keep）", "description": "保留已有止损止盈。"},
                    {
                        "const": "override",
                        "title": "覆盖（override）",
                        "description": "使用新值覆盖旧值。",
                    },
                    {
                        "const": "overridenan",
                        "title": "仅覆盖非空（overridenan）",
                        "description": "仅当新值非空时才覆盖。",
                    },
                ],
            },
            "use_stops": {
                "type": "boolean",
                "title": "启用止损止盈",
                "description": "总开关：是否启用止损止盈逻辑。",
            },
            "cash_sharing": {
                "type": "boolean",
                "title": "组内共享现金",
                "description": "分组组合下，组内标的是否共享同一现金池。",
            },
            "group_by": {
                "type": "boolean",
                "title": "按组聚合",
                "description": "是否按分组进行聚合计算和展示。",
            },
            "ffill_val_price": {
                "type": "boolean",
                "title": "估值价前向填充",
                "description": "估值价缺失时是否前向填充。",
            },
            "update_value": {
                "type": "boolean",
                "title": "逐步更新净值",
                "description": "是否在每个时间步更新组合净值状态。",
            },
            "seed": {
                "type": "integer",
                "title": "随机种子",
                "description": "随机过程（如拒单概率）使用的种子，保证可复现。",
            },
            "freq": {
                "type": "string",
                "title": "时间频率",
                "description": "时间序列频率（如 1D、1h），用于年化等统计指标。",
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
                                        "title": "忽略（ignore）",
                                        "description": "忽略反向入场信号。",
                                    },
                                    {
                                        "const": "close",
                                        "title": "平仓（close）",
                                        "description": "仅平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓（closereduce）",
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
                                        "title": "忽略（ignore）",
                                        "description": "忽略反向入场信号。",
                                    },
                                    {
                                        "const": "close",
                                        "title": "平仓（close）",
                                        "description": "仅平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓（closereduce）",
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
                                        "title": "平仓（close）",
                                        "description": "平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓（closereduce）",
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
                                        "title": "平仓（close）",
                                        "description": "平掉当前仓位。",
                                    },
                                    {
                                        "const": "closereduce",
                                        "title": "平仓或减仓（closereduce）",
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
        "required": ["initial_cash", "fees", "slippage"],
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
        "initial_cash": {"nav": "basic"},
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

    defaults = RunBacktestRequest(
        strategy_id="__placeholder__",
        data_set_id="__placeholder__",
        initial_cash=1_000_000,
        fees=0.0003,
        slippage=0.0,
    ).model_dump(mode="json")

    # 只返回表单字段的默认值
    default_values = {k: defaults[k] for k in schema["properties"] if k in defaults}

    return BacktestRunFormSpecPublic(
        schema=schema, uiSchema=ui_schema, default_values=default_values
    )
