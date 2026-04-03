"""echarts_line – demo line chart option for ECharts (static data; no upstream wiring)."""

from __future__ import annotations

from typing import Any

import pandas as pd
from workflow import Socket, StringNodeParam, workflow_node


@workflow_node(
    label="ECharts 线图",
    description="返回静态 ECharts 折线图 option（演示）；不处理上游输入",
    input_sockets=[
        Socket("data", required=False, value_type="dataframe", label="数据(Dataframe)"),
        StringNodeParam("series_name", required=False, default="value", label="系列名称"),
    ],
    output_sockets=[Socket("option", value_type="scalar_json")],
    entry="execute",
)
class EchartsLineNode:
    def execute(
        self, data: pd.DataFrame, series_name: str = "value", **kwargs: Any
    ) -> tuple[dict[str, Any]]:
        series = data[series_name]
        # ECharts option 会被最终经由 `json.dumps` 持久化。
        # 若 index 元素是 pandas.Timestamp，则它不可直接 JSON 序列化，需先转字符串。
        raw_dates = data.index.tolist()
        dates = [(d.isoformat() if hasattr(d, "isoformat") else str(d)) for d in raw_dates]
        option = {
            "title": {"text": "线图（演示）"},
            "tooltip": {"trigger": "axis"},
            "xAxis": {"type": "category", "data": dates},
            "yAxis": {"type": "value"},
            "series": [
                {
                    "type": "line",
                    "data": series.tolist(),
                    "smooth": True,
                }
            ],
        }
        return {
            "type": "echart",
            "option": option,
        }
