from typing import ClassVar

from app.workflows.node_plugin import NodePlugin

from evaluation_nodes.calculate_factor_value import CalculateFactorValueNode
from evaluation_nodes.load_data_set import LoadDataSet


class EvaluationNodesPlugin(NodePlugin):
    name = "evaluation"
    nodes: ClassVar[list[type]] = [
        LoadDataSet,
        CalculateFactorValueNode,
    ]
