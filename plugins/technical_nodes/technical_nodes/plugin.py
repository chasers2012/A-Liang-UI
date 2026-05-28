from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from technical_nodes.nodes import (
    AtrNode,
    BbandsNode,
    EmaNode,
    MacdNode,
    MaNode,
    MstdNode,
    ObvNode,
    RsiNode,
    StochNode,
)


class TechnicalNodesPlugin(NodePlugin):
    name = "technical-nodes"
    nodes: ClassVar[list[type]] = [
        MaNode,
        EmaNode,
        MstdNode,
        BbandsNode,
        RsiNode,
        StochNode,
        MacdNode,
        AtrNode,
        ObvNode,
    ]
