"""viz_bars_diverging – zero-centered diverging bar chart."""

from __future__ import annotations

from workflow import workflow_node, workflow_socket

from ._viz_base import VizNodeBase


@workflow_node(
    type_id="viz_bars_diverging",
    label="可视化·双向条形图",
    description="零轴居中条形；仅透传数据",
    input_sockets=[workflow_socket("in", required=True, value_type="scalar_json")],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
    entry="execute",
)
class VizBarsDivergingNode(VizNodeBase):
    pass
