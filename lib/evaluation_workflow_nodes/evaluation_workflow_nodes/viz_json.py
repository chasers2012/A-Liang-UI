"""viz_json – raw JSON display."""

from __future__ import annotations

from workflow import workflow_node, workflow_socket

from ._viz_base import VizNodeBase


@workflow_node(
    type_id="viz_json",
    label="可视化·JSON",
    description="JSON 原文；仅透传数据",
    input_sockets=[workflow_socket("in", required=True, value_type="scalar_json")],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
    entry="execute",
)
class VizJsonNode(VizNodeBase):
    pass
