from __future__ import annotations

import pytest
from app.evaluation.scheme.graph_validate import validate_workflow_graph
from app.evaluation.scheme.profile_schemas import EvaluationWorkflow
from workflow import WorkflowLink, WorkflowNode


def test_duplicate_node_types_allowed():
    mid = "metric:builtin.mean_ic"
    wf = EvaluationWorkflow(
        nodes=[
            WorkflowNode(id="a", type="prepare_alphalens", pos=[0, 0], params={}),
            WorkflowNode(id="m1", type=mid, pos=[1, 0], params={}),
            WorkflowNode(id="m2", type=mid, pos=[2, 0], params={}),
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
    allowed = frozenset({"prepare_alphalens", mid})
    validate_workflow_graph(wf, allowed_types=allowed)


def test_duplicate_target_socket_rejected():
    mid = "metric:builtin.mean_ic"
    wf = EvaluationWorkflow(
        nodes=[
            WorkflowNode(id="a", type="prepare_alphalens", pos=[0, 0], params={}),
            WorkflowNode(id="m1", type=mid, pos=[1, 0], params={}),
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
    allowed = frozenset({"prepare_alphalens", mid})
    with pytest.raises(ValueError, match="只能连接一条边"):
        validate_workflow_graph(wf, allowed_types=allowed)
