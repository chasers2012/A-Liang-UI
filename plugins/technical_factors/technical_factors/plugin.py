from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from technical_factors.nodes import (
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


class TechnicalFactorsPlugin(NodePlugin):
    name = "technical-factors"
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
