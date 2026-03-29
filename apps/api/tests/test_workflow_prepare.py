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


def test_list_evaluation_metrics_has_builtin(client):
    r = client.get("/evaluation-metrics")
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert "builtin.mean_ic" in ids
    builtins = [x for x in r.json() if x.get("builtin")]
    assert len(builtins) >= 2


def test_builtin_metric_detail_has_workspace_source(client):
    r = client.get("/evaluation-metrics/builtin.mean_ic")
    assert r.status_code == 200
    body = r.json()
    assert body["source_path"] == "evaluation/metrics/source/builtin.mean_ic.py"
    assert "BuiltinMeanICMetric" in body["source"]
    assert body.get("builtin") is True


def test_patch_builtin_metric_forbidden(client):
    r = client.patch("/evaluation-metrics/builtin.mean_ic", json={"description": "x"})
    assert r.status_code == 400
    assert "内置" in r.json()["detail"]


def test_delete_builtin_metric_forbidden(client):
    r = client.delete("/evaluation-metrics/builtin.mean_ic")
    assert r.status_code == 400
