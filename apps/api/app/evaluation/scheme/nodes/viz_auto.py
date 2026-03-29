"""viz_auto – auto-select bar style based on whether values contain negatives."""

from __future__ import annotations

from workflow import workflow_node, workflow_socket

from ._viz_base import VizNodeBase


@workflow_node(
    type_id="viz_auto",
    label="可视化·自动",
    description="按数值是否含负自动选条形样式；仅透传数据",
    input_sockets=[workflow_socket("in", required=True, value_type="scalar_json")],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
    entry="execute",
)
class VizAutoNode(VizNodeBase):
    pass
