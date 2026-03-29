"""viz_scalar – single large-format scalar display."""

from __future__ import annotations

from workflow import workflow_node, workflow_socket

from ._viz_base import VizNodeBase


@workflow_node(
    type_id="viz_scalar",
    label="可视化·单值",
    description="大号单值（多项时仍按自动规则）；仅透传数据",
    input_sockets=[workflow_socket("in", required=True, value_type="scalar_json")],
    output_sockets=[workflow_socket("out", value_type="scalar_json")],
    entry="execute",
)
class VizScalarNode(VizNodeBase):
    pass
