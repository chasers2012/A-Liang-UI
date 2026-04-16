from __future__ import annotations

from typing import Any, ClassVar, Literal

import pandas as pd
from workflow import Socket, workflow_node
from workflow.node_types import BooleanNodeParam, NumberNodeParam, OptionsNodeParam


@workflow_node(
    input_sockets=[
        Socket("x", required=True, value_type="factor_df", label="X"),
        NumberNodeParam("threshold", required=True, default=0.0, label="阈值"),
        OptionsNodeParam(
            name="direction",
            label="方向",
            description="大于阈值或小于阈值触发",
            options=lambda: [
                {"label": "x > threshold", "value": "gt"},
                {"label": "x < threshold", "value": "lt"},
            ],
        ),
    ],
    output_sockets=[Socket("signal", required=True, value_type="signal_df", label="信号")],
    label="阈值信号",
    description="按阈值生成布尔信号矩阵。",
    category="strategy",
)
class ThresholdSignalNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        x: pd.DataFrame = kwargs["x"]
        thr = float(kwargs.get("threshold") or 0.0)
        direction: Literal["gt", "lt"] = (
            "gt" if str(kwargs.get("direction") or "gt") == "gt" else "lt"
        )
        if direction == "gt":
            return (x > thr).fillna(False)
        return (x < thr).fillna(False)


@workflow_node(
    input_sockets=[
        Socket("factor", required=True, value_type="factor", label="因子"),
        NumberNodeParam("k", required=True, default=10, label="TopK"),
        BooleanNodeParam("ascending", required=False, default=False, label="升序(小值优先)"),
    ],
    output_sockets=[Socket("selected", required=True, value_type="signal_df", label="选中")],
    label="TopK 选股",
    description="按截面排序选前 K。",
    category="strategy",
)
class RankTopKNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        f: pd.DataFrame = kwargs["factor"]
        k = int(kwargs.get("k") or 10)
        ascending = bool(kwargs.get("ascending") or False)
        if k <= 0:
            raise ValueError("k 必须 > 0")
        ranks = f.rank(axis=1, method="first", ascending=ascending)
        return (ranks <= k).fillna(False)


@workflow_node(
    input_sockets=[Socket("selected", required=True, value_type="signal_df", label="选中")],
    output_sockets=[Socket("weights", required=True, value_type="weights_df", label="权重")],
    label="等权分配",
    description="对选中资产等权分配。",
    category="strategy",
)
class EqualWeightNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        sel: pd.DataFrame = kwargs["selected"]
        sel_num = sel.astype(float)
        denom = sel_num.sum(axis=1).replace(0.0, pd.NA)
        return sel_num.div(denom, axis=0).fillna(0.0)


@workflow_node(
    input_sockets=[
        Socket("weights", required=True, value_type="weights_df", label="权重"),
        OptionsNodeParam(
            name="freq",
            label="调仓频率",
            description="D/W/M",
            options=lambda: [
                {"label": "每日(D)", "value": "D"},
                {"label": "每周(W)", "value": "W"},
                {"label": "每月(M)", "value": "M"},
            ],
        ),
    ],
    output_sockets=[Socket("weights", required=True, value_type="weights_df", label="权重")],
    label="调仓频率",
    description="按频率更新权重（非调仓日沿用上一期）。",
    category="strategy",
)
class RebalanceNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        w: pd.DataFrame = kwargs["weights"]
        freq = str(kwargs.get("freq") or "D").upper()
        if w.empty:
            return w
        idx = pd.to_datetime(w.index)
        w2 = w.copy()
        w2.index = idx
        if freq == "D":
            return w2
        if freq == "W":
            mask = (
                idx.to_series()
                .dt.isocalendar()
                .week.ne(idx.to_series().shift(1).dt.isocalendar().week)
            )
        elif freq == "M":
            mask = idx.to_series().dt.to_period("M").ne(idx.to_series().shift(1).dt.to_period("M"))
        else:
            raise ValueError("freq 必须为 D/W/M")
        mask.iloc[0] = True
        w2.loc[~mask.values, :] = pd.NA
        return w2.ffill().fillna(0.0)


@workflow_node(
    input_sockets=[
        Socket("weights", required=True, value_type="weights_df", label="权重"),
        NumberNodeParam("bars", required=True, default=1, label="bars"),
    ],
    output_sockets=[Socket("weights", required=True, value_type="weights_df", label="权重")],
    label="信号滞后",
    description="将权重右移 bars，避免未来函数。",
    category="strategy",
)
class LagNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        w: pd.DataFrame = kwargs["weights"]
        bars = int(kwargs.get("bars") or 1)
        if bars < 0:
            raise ValueError("bars 必须 >= 0")
        return w.shift(bars).fillna(0.0)


def _weights_to_position(weights: pd.DataFrame) -> pd.DataFrame:
    if weights.empty:
        idx = pd.MultiIndex.from_arrays([[], []], names=["date", "asset"])
        return pd.DataFrame(index=idx, data={"position": []})

    w = weights.copy()
    w.index = pd.to_datetime(w.index)
    w.index.name = "date"
    w.columns = [str(c) for c in w.columns]
    position = w.stack(dropna=False).rename("position").fillna(0.0).to_frame()
    position.index = position.index.set_names(["date", "asset"])
    return position.sort_index()


@workflow_node(
    input_sockets=[
        Socket("weights", required=True, value_type="weights_df", label="权重"),
    ],
    output_sockets=[Socket("position", required=True, value_type="position_df", label="持仓")],
    label="输出持仓",
    description="将宽表权重转换为 MultiIndex(date, asset) 的持仓矩阵。",
    category="strategy",
)
class ToPositionNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        weights: pd.DataFrame = kwargs["weights"]
        return _weights_to_position(weights)


__all__: ClassVar[list[str]] = [
    "EqualWeightNode",
    "LagNode",
    "RankTopKNode",
    "RebalanceNode",
    "ThresholdSignalNode",
    "ToPositionNode",
]
