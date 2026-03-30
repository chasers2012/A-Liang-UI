"""echarts_bar – demo bar chart option for ECharts (static data; no upstream wiring)."""

from __future__ import annotations

from typing import Any

from workflow import workflow_node, workflow_socket


def _demo_bar_option() -> dict[str, Any]:
    return {
        "title": {"text": "条形图（演示）"},
        "tooltip": {"trigger": "axis"},
        "xAxis": {"type": "category", "data": ["A", "B", "C", "D"]},
        "yAxis": {"type": "value"},
        "series": [
            {
                "type": "bar",
                "data": [23, 45, 12, 38],
            }
        ],
    }


@workflow_node(
    label="ECharts 条形图",
    description="返回静态 ECharts 条形图 option（演示）；不处理上游输入",
    input_sockets=[workflow_socket("in", required=False, value_type="scalar_json")],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
    entry="execute",
)
class EchartsBarNode:
    def execute(self, **kwargs: Any) -> tuple[dict[str, Any]]:
        option = _demo_bar_option()
        return (option,)
