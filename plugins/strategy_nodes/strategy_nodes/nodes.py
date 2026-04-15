from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar, Literal

import pandas as pd
from app.data_set.controller import get_data_set
from app.data_set.redistry import DataSetsStore
from app.factors.controller import get_factor
from app.factors.registry import FactorItemsRegistry
from factor.data_set import DataSet
from workflow import Socket, workflow_node
from workflow.node_types import BooleanNodeParam, NumberNodeParam, OptionsNodeParam


def _wide_from_panel(panel: pd.DataFrame, *, field: str) -> pd.DataFrame:
    if panel.empty:
        return pd.DataFrame()
    if not isinstance(panel.index, pd.MultiIndex):
        raise ValueError("panel must have MultiIndex (date, asset)")
    if field not in panel.columns:
        raise ValueError(f"panel missing field {field!r}")
    s = panel[field]
    out = s.unstack("asset")
    out.index.name = "date"
    out.columns = [str(c) for c in out.columns]
    return out.sort_index()


@workflow_node(
    input_sockets=[
        OptionsNodeParam(
            name="data_set",
            label="数据集",
            description="选择要加载的数据集 ID",
            options=lambda: [{"label": s.name, "value": s.id} for s in DataSetsStore.list_items()],
        )
    ],
    output_sockets=[
        Socket("data_set", required=True, value_type="data_set", label="数据集"),
        Socket("close", required=True, value_type="price_df", label="收盘价"),
        Socket("open", required=False, value_type="price_df", label="开盘价"),
    ],
    label="加载数据集(策略)",
    description="加载 DataSet 并输出价格矩阵（close/open）。",
    category="strategy",
)
class LoadDataSetNode:
    def execute(self, **kwargs: Any) -> tuple[DataSet, pd.DataFrame, pd.DataFrame]:
        raw = kwargs.get("data_set")
        if isinstance(raw, DataSet):
            ds = raw
        else:
            ds_id = str(raw or "").strip()
            if not ds_id:
                raise ValueError("data_set 不能为空")
            ds = get_data_set(ds_id)
            if ds is None:
                raise ValueError("数据集不存在")

        panel = ds.get_panel(fields=["close", "open"], window=1)
        close = _wide_from_panel(panel, field="close")
        open_ = _wide_from_panel(panel, field="open")
        return ds, close, open_


@workflow_node(
    input_sockets=[
        Socket("data_set", required=True, value_type="data_set", label="数据集"),
        OptionsNodeParam(
            name="factor_id",
            label="因子",
            description="选择因子 ID",
            options=lambda: [
                {"label": f.name, "value": f.id} for f in FactorItemsRegistry.list_items()
            ],
        ),
    ],
    output_sockets=[Socket("factor", required=True, value_type="factor_df", label="因子矩阵")],
    label="因子引用",
    description="加载并计算因子，输出 time×asset 矩阵。",
    category="strategy",
)
class FactorRefNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        ds: DataSet = kwargs["data_set"]
        factor_id = str(kwargs.get("factor_id") or "").strip()
        if not factor_id:
            raise ValueError("factor_id 不能为空")
        factor_cls = get_factor(factor_id)
        if factor_cls is None:
            raise ValueError("因子不存在或无法加载")
        if not ds.end_date:
            raise ValueError("数据集缺少 end_date")
        resolver = ds.create_resolver()
        factor = factor_cls(dependency_resolver=resolver)
        df = factor.calculate(
            start_date=ds.start_date, end_date=ds.end_date, instrument_codes=ds.instrument_codes
        )
        col = df.columns[0] if len(df.columns) else factor.name
        wide = df[col].unstack("asset")
        wide.index.name = "date"
        wide.columns = [str(c) for c in wide.columns]
        return wide.sort_index()


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
        Socket("factor", required=True, value_type="factor_df", label="因子"),
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


@dataclass(frozen=True)
class BacktestInputs:
    close: pd.DataFrame
    weights: pd.DataFrame


@workflow_node(
    input_sockets=[
        Socket("close", required=True, value_type="price_df", label="收盘价"),
        Socket("weights", required=True, value_type="weights_df", label="权重"),
    ],
    output_sockets=[
        Socket("backtest_inputs", required=True, value_type="backtest_inputs", label="回测输入")
    ],
    label="输出回测输入",
    description="将 close + weights 打包。",
    category="strategy",
)
class ToBacktestInputsNode:
    def execute(self, **kwargs: Any) -> BacktestInputs:
        close: pd.DataFrame = kwargs["close"]
        weights: pd.DataFrame = kwargs["weights"]
        return BacktestInputs(close=close, weights=weights)


__all__: ClassVar[list[str]] = [
    "BacktestInputs",
    "EqualWeightNode",
    "FactorRefNode",
    "LagNode",
    "LoadDataSetNode",
    "RankTopKNode",
    "RebalanceNode",
    "ThresholdSignalNode",
    "ToBacktestInputsNode",
]
