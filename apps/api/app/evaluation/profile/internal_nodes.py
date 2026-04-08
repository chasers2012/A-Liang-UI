from evaluation_workflow_nodes import common as common_nodes_pkg
from evaluation_workflow_nodes.calculate_factor_value import CalculateFactorValueNode
from evaluation_workflow_nodes.collect_result import CollectResult
from evaluation_workflow_nodes.load_data_set import LoadDataSet
from evaluation_workflow_nodes.visiualization.echarts_line import EchartsLineNode
from workflow import Node, collect_node_classes
from workflow.parser import Parser

from app.evaluation.profile.schemas import EvaluationNodeTypePublic

_COMMON_NODE_CLASSES = list(collect_node_classes(common_nodes_pkg).values())

INTERNAL_NODES = [
    # auto-discovered common nodes (e.g. Params-* in evaluation_workflow_nodes.common)
    *_COMMON_NODE_CLASSES,
    LoadDataSet,
    CalculateFactorValueNode,
    CollectResult,
    EchartsLineNode,
]


def get_internal_nodes() -> list[EvaluationNodeTypePublic]:
    ret = []
    for node in INTERNAL_NODES:
        node_instance: Node = node()
        ret.append(
            EvaluationNodeTypePublic(
                type=node_instance.type,
                label=node_instance.label,
                description=node_instance.description,
                category=node_instance.category,
                inputs=[Parser.serialize_socket(s) for s in node_instance.inputs],
                outputs=[Parser.serialize_socket(s) for s in node_instance.outputs],
            )
        )
    return ret
