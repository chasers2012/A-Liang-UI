from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, workflow_node
from workflow.node_types import NumberNodeParam


@workflow_node(
    input_sockets=[
        Socket("table", required=True, value_type="dataframe", label="宽表"),
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
        bars = int(kwargs.get("bars") or 1)
        if bars < 0:
            raise ValueError("bars 必须 >= 0")
        if bars == 0:
            return table.copy()
        out = table.copy()
        return out.shift(bars)
