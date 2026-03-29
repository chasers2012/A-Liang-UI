"""echarts_line – demo line chart option for ECharts (static data; no upstream wiring)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from workflow import WorkflowNode, workflow_node, workflow_socket


def _demo_line_option() -> dict[str, Any]:
    return {
        "title": {"text": "线图（演示）"},
        "tooltip": {"trigger": "axis"},
        "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
        "yAxis": {"type": "value"},
        "series": [
            {
                "type": "line",
                "data": [120, 200, 150, 80, 70],
                "smooth": True,
            }
        ],
    }


@workflow_node(
    type_id="echarts_line",
    label="ECharts 线图",
    description="返回静态 ECharts 折线图 option（演示）；不处理上游输入",
    input_sockets=[workflow_socket("in", required=False, value_type="scalar_json")],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
    entry="execute",
)
class EchartsLineNode:
    def execute(
        self,
        node: WorkflowNode,
        inputs: Mapping[str, Any],
    ) -> dict[str, Any]:
        del inputs
        option = _demo_line_option()
        return {"out": option}
