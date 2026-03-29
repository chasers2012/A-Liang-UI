from __future__ import annotations

from app.evaluation.scheme.profile_schemas import (
    EvaluationProfilePrepare,
    EvaluationWorkflow,
)
from app.evaluation.scheme.workflow_prepare import merge_profile_prepare_into_workflow
from workflow import WorkflowNode


def test_merge_profile_prepare_into_prepare_alphalens_node():
    wf = EvaluationWorkflow(
        nodes=[
            WorkflowNode(id="p", type="prepare_alphalens", pos=[0, 0], params={}),
        ],
        links=[],
    )
    prep = EvaluationProfilePrepare(
        forward_return_periods=[2, 4],
        quantiles=7,
        long_short=False,
        max_loss=0.25,
    )
    out = merge_profile_prepare_into_workflow(wf, profile_prepare=prep)
    assert out.nodes[0].params["forward_return_periods"] == "2,4"
    assert out.nodes[0].params["alphalens_quantiles"] == "7"
    assert out.nodes[0].params["long_short"] is False
    assert out.nodes[0].params["max_loss"] == 0.25


def test_list_evaluation_metrics_is_user_registry_only(client):
    r = client.get("/evaluation-metrics")
    assert r.status_code == 200
    for row in r.json():
        assert row.get("builtin") is not True
        assert "workflow_type_id" in row


def test_node_types_include_builtin_eval_metric_nodes(client):
    r = client.get("/evaluation-profiles/node-types")
    assert r.status_code == 200
    types = {x["type"] for x in r.json()}
    assert "builtin_mean_ic" in types
    assert "builtin_mean_return_spread" in types
