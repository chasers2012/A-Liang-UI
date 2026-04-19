from __future__ import annotations

from typing import Any, ClassVar

import pandas as pd
from workflow import Socket, workflow_node
from workflow.node_types import BooleanNodeParam, NumberNodeParam


@workflow_node(
    input_sockets=[
        Socket("factor", required=True, value_type="dataframe", label="因子"),
        Socket("mask", required=False, value_type="dataframe", label="掩码"),
        NumberNodeParam("k", required=True, default=10, label="K"),
        BooleanNodeParam("ascending", required=False, default=False, label="升序(小值优先)"),
    ],
    output_sockets=[Socket("weights", required=True, value_type="dataframe", label="权重")],
    label="TopK 等权",
    description=(
        "按截面排序选前 K，并对选中资产等权分配。\n"
        "\n"
        "输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | 1.2  | 0.8  | 2.4  |\n"
        "| 2026-04-02 | 1.5  | 0.7  | 2.1  |\n"
        "\n"
        "mask 示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | True | False| True |\n"
        "| 2026-04-02 | True | True | False|\n"
        "\n"
        "输出示例（k=2，升序=否）：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | 0.5  | 0.0  | 0.5  |\n"
        "| 2026-04-02 | 1.0  | 0.0  | 0.0  |\n"
    ),
    category="strategy",
)
class RankTopKEqualWeightNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        f: pd.DataFrame = kwargs["factor"]
        mask: pd.DataFrame | None = kwargs.get("mask")
        k = int(kwargs.get("k") or 10)
        ascending = bool(kwargs.get("ascending") or False)
        if k <= 0:
            raise ValueError("k 必须 > 0")
        ranks = f.rank(axis=1, method="first", ascending=ascending)
        selected = (ranks <= k).fillna(False)
        if mask is not None:
            selected = selected & mask.fillna(False).astype(bool)
        sel_num = selected.astype(float)
        denom = sel_num.sum(axis=1).replace(0.0, pd.NA)
        return sel_num.div(denom, axis=0).fillna(0.0)


@workflow_node(
    input_sockets=[
        Socket("weights", required=True, value_type="dataframe", label="权重"),
        NumberNodeParam("freq", required=True, default=1, label="调仓频率"),
    ],
    output_sockets=[Socket("weights", required=True, value_type="dataframe", label="权重")],
    label="调仓频率",
    description=(
        "按固定间隔更新权重（非调仓日沿用上一期）。\n"
        "\n"
        "输入示例：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | 0.5  | 0.0  | 0.5  |\n"
        "| 2026-04-02 | 0.2  | 0.6  | 0.2  |\n"
        "| 2026-04-03 | 0.4  | 0.2  | 0.4  |\n"
        "| 2026-04-04 | 0.1  | 0.8  | 0.1  |\n"
        "\n"
        "输出示例（freq=2）：\n"
        "\n"
        "| date       | AAPL | MSFT | NVDA |\n"
        "|------------|------|------|------|\n"
        "| 2026-04-01 | 0.5  | 0.0  | 0.5  |\n"
        "| 2026-04-02 | 0.5  | 0.0  | 0.5  |\n"
        "| 2026-04-03 | 0.4  | 0.2  | 0.4  |\n"
        "| 2026-04-04 | 0.4  | 0.2  | 0.4  |\n"
    ),
    category="strategy",
)
class RebalanceNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        w: pd.DataFrame = kwargs["weights"]
        freq = int(kwargs.get("freq") or 1)
        if freq <= 0:
            raise ValueError("freq 必须 > 0")
        if w.empty or freq == 1:
            return w
        mask = pd.Series(False, index=w.index)
        mask.iloc[::freq] = True
        w.loc[~mask.values, :] = pd.NA
        return w.ffill().fillna(0.0)


__all__: ClassVar[list[str]] = [
    "RankTopKEqualWeightNode",
    "RebalanceNode",
]
