USER_NODE_WORKFLOW_ROOT = "workflow_nodes/user"
REGISTRY_FILENAME = "nodes/registry.json"

# Synthetic timestamps for plugin-registered workflow nodes.
PLUGIN_NODE_TIMESTAMP_ISO = "1970-01-01T00:00:00+00:00"

DEFAULT_NODE_SOURCE = """
from __future__ import annotations
from typing import Any
from workflow import workflow_node, Socket, Node


@workflow_node(
    label="新节点",
    description="",
    entry="execute",
    input_sockets=[
        Socket("input", required=False, value_type="any"),
    ],
    output_sockets=[
        Socket("out", value_type="any"),
    ],
)
class NewWorkflowNode(Node):

    def execute(self, **kwargs: Any) -> tuple[Any, ...]:
        _ = kwargs
        return (None,)
"""
