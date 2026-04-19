from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, workflow_node
from workflow.node_types import NumberNodeParam, StringNodeParam


@workflow_node(
    input_sockets=[
        Socket("table", required=True, value_type="dataframe", label="表"),
        StringNodeParam(
            "column",
            required=True,
            default="value",
            label="列名",
            description="需要执行 lag 的列名",
        ),
        NumberNodeParam("bars", required=True, default=1, label="bars"),
    ],
    output_sockets=[Socket("out", required=True, value_type="dataframe", label="输出")],
    label="Lag",
    description="对指定列执行滞后操作，避免未来函数。",
    category="common",
)
class LagNode:
    def execute(self, **kwargs: Any) -> pd.DataFrame:
        table: pd.DataFrame = kwargs["table"]
        column = str(kwargs.get("column") or "value")
        bars = int(kwargs.get("bars") or 1)
        if bars < 0:
            raise ValueError("bars 必须 >= 0")
        if column not in table.columns:
            raise ValueError(f"找不到列 {column}")
        out = table.copy()
        out[column] = out[column].shift(bars).fillna(0.0)
        return out
