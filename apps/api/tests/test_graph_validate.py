from __future__ import annotations

import pytest
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry
from app.evaluation.scheme.graph_validate import validate_workflow_graph
from app.evaluation.scheme.profile_schemas import EvaluationWorkflow
from app.evaluation.scheme.workflow_graph_types import all_workflow_node_type_ids
from workflow import Node, WorkflowLink

_CALC = "evaluation_workflow_nodes.calculate_factor_value.CalculateFactorValueNode"
_MIC = "evaluation_workflow_nodes.metric_builtin_mean_ic.BuiltinMeanIcNode"


def test_duplicate_node_types_allowed(workspace_tmp):
    EvaluationMetricsRegistry.load()
    wf = EvaluationWorkflow(
        nodes=[
            Node(id="a", type=_CALC, pos=[0, 0], params={}),
            Node(id="m1", type=_MIC, pos=[1, 0], params={}),
            Node(id="m2", type=_MIC, pos=[2, 0], params={}),
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
    validate_workflow_graph(wf, allowed_types=all_workflow_node_type_ids())


def test_duplicate_target_socket_rejected(workspace_tmp):
    EvaluationMetricsRegistry.load()
    wf = EvaluationWorkflow(
        nodes=[
            Node(id="a", type=_CALC, pos=[0, 0], params={}),
            Node(id="m1", type=_MIC, pos=[1, 0], params={}),
        ],
        links=[
            WorkflowLink(
                from_node="a", from_socket="clean_factor", to_node="m1", to_socket="clean_factor"
            ),
            WorkflowLink(
                from_node="a", from_socket="clean_factor", to_node="m1", to_socket="clean_factor"
            ),
        ],
    )
    with pytest.raises(ValueError, match="只能连接一条边"):
        validate_workflow_graph(wf, allowed_types=all_workflow_node_type_ids())
