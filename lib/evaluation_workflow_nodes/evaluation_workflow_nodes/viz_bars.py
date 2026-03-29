"""viz_bars – non-negative bar chart (left-filled, absolute length for negatives)."""

from __future__ import annotations

from workflow import workflow_node, workflow_socket

from ._viz_base import VizNodeBase


@workflow_node(
    type_id="viz_bars",
    label="可视化·条形图",
    description="非负从左填充；含负时按绝对长度从左；仅透传数据",
    input_sockets=[workflow_socket("in", required=True, value_type="scalar_json")],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
    entry="execute",
)
class VizBarsNode(VizNodeBase):
    pass
