from typing import ClassVar

from app.workflows.node_plugin import NodePlugin

from common_nodes.json_nodes import JsonParseNode, JsonToDataframeNode, LongTextParamsNode
from common_nodes.param_input_nodes import (
    BooleanParamsNode,
    DateParamsNode,
    DateTimeParamsNode,
    NumberParamsNode,
    StringParamsNode,
)


class CommonNodesPlugin(NodePlugin):
    name = "common"
    nodes: ClassVar[list[type]] = [
        NumberParamsNode,
        BooleanParamsNode,
        StringParamsNode,
        DateParamsNode,
        DateTimeParamsNode,
        JsonToDataframeNode,
        JsonParseNode,
        LongTextParamsNode,
    ]
