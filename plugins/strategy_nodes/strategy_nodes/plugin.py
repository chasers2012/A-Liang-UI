from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from strategy_nodes.nodes import (
    EqualWeightNode,
    LagNode,
    RankTopKNode,
    RebalanceNode,
    ThresholdSignalNode,
    ToPositionNode,
)


class StrategyNodesPlugin(NodePlugin):
    name = "strategy"
    visible_domains: ClassVar[tuple[str, ...]] = ("strategy",)
    nodes: ClassVar[list[type]] = [
        ThresholdSignalNode,
        RankTopKNode,
        EqualWeightNode,
        RebalanceNode,
        LagNode,
        ToPositionNode,
    ]
