from typing import ClassVar

from app.nodes.node_plugin import NodePlugin

from evaluation_nodes.calculate_factor_value import CalculateFactorValueNode


class EvaluationNodesPlugin(NodePlugin):
    name = "evaluation"
    visible_domains: ClassVar[tuple[str, ...]] = ("evaluation-profile",)
    nodes: ClassVar[list[type]] = [
        CalculateFactorValueNode,
    ]
