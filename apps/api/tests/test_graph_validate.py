from __future__ import annotations

from app.evaluation.metrics.redistry import EvaluationMetricsRegistry
from app.evaluation.profile.schemas import EvaluationWorkflow
from workflow import Node, WorkflowLink

_CALC = "evaluation_workflow_nodes.calculate_factor_value.CalculateFactorValueNode"
_MIC = "evaluation_workflow_nodes.mean_ic.MeanIC"


def test_duplicate_node_types_allowed(workspace_tmp):
    EvaluationMetricsRegistry.load()
    EvaluationWorkflow(
        nodes=[
            Node(id="a", type=_CALC, pos=[0, 0]),
            Node(id="m1", type=_MIC, pos=[1, 0]),
            Node(id="m2", type=_MIC, pos=[2, 0]),
        ],
        links=[
            WorkflowLink(
                from_node="a", from_socket="clean_factor", to_node="m1", to_socket="clean_factor"
            ),
            WorkflowLink(
                from_node="a", from_socket="clean_factor", to_node="m2", to_socket="clean_factor"
            ),
        ],
    )
