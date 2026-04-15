from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from strategy_nodes.nodes import (
    EqualWeightNode,
    FactorRefNode,
    LagNode,
    LoadDataSetNode,
    RankTopKNode,
    RebalanceNode,
    ThresholdSignalNode,
    ToPositionNode,
)


class StrategyNodesPlugin(NodePlugin):
    name = "strategy"
    visible_domains: ClassVar[tuple[str, ...]] = ("strategy",)
    nodes: ClassVar[list[type]] = [
        LoadDataSetNode,
        FactorRefNode,
        ThresholdSignalNode,
        RankTopKNode,
        EqualWeightNode,
        RebalanceNode,
        LagNode,
        ToPositionNode,
    ]
