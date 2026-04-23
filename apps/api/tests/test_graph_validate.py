from __future__ import annotations

from app.evaluation.metrics.controller import ensure_metrics_loaded
from app.evaluation.profile.schemas import EvaluationWorkflow
from workflow import Node

_FACTOR_REF = "common_nodes.factor_ref.FactorRefNode"
_MIC = "evaluation_workflow_nodes.mean_ic.MeanIC"


def test_duplicate_node_types_allowed(workspace_tmp):
    ensure_metrics_loaded()
    EvaluationWorkflow(
        nodes=[
            Node(id="a", type=_FACTOR_REF, pos=[0, 0]),
            Node(id="m1", type=_MIC, pos=[1, 0]),
            Node(id="m2", type=_MIC, pos=[2, 0]),
        ],
        links=[],
    )
