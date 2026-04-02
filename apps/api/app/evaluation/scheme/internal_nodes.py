from evaluation_workflow_nodes.collect_result import CollectResult
from workflow import Node

from app.evaluation.scheme.nodes.calculate_factor_value import CalculateFactorValueNode
from app.evaluation.scheme.nodes.data_set_node import LoadDataSet
from app.evaluation.scheme.profile_schemas import EvaluationNodeTypePublic

INTERNAL_NODES = [LoadDataSet, CalculateFactorValueNode, CollectResult]


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
                inputs=[s.serialize() for s in node_instance.inputs],
                outputs=[s.serialize() for s in node_instance.outputs],
            )
        )
    return ret
