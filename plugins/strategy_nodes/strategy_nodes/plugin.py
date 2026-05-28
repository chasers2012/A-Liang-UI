from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from strategy_nodes.nodes import RankTopKEqualWeightNode, RebalanceNode


class StrategyNodesPlugin(NodePlugin):
    name = "strategy"
    visible_domains: ClassVar[tuple[str, ...]] = ("strategy",)
    nodes: ClassVar[list[type]] = [RebalanceNode, RankTopKEqualWeightNode]
