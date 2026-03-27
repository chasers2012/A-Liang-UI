from __future__ import annotations

from app.evaluation.builtin_metric_registry import metric_node_type
from app.evaluation.profile_schemas import EvaluationWorkflow, WorkflowNode
from app.evaluation.workflow_migrate import migrate_evaluation_workflow


def test_migrate_user_metric_to_metric_prefix():
    wf = EvaluationWorkflow(
        nodes=[
            WorkflowNode(
                id="a",
                type="user_metric",
                pos=[0, 0],
                params={"metric_id": "abc-123"},
            ),
        ],
        links=[],
    )
    out = migrate_evaluation_workflow(wf)
    assert out.nodes[0].type == metric_node_type("abc-123")
    assert out.nodes[0].params == {}


def test_migrate_legacy_mean_ic():
    wf = EvaluationWorkflow(
        nodes=[WorkflowNode(id="x", type="mean_information_coefficient", pos=[1, 1], params={})],
        links=[],
    )
    out = migrate_evaluation_workflow(wf)
    assert out.nodes[0].type == metric_node_type("builtin.mean_ic")


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
    assert body["source_path"] == "evaluation_metrics/builtin.mean_ic.py"
    assert "BuiltinMeanICMetric" in body["source"]
    assert body.get("builtin") is True


def test_patch_builtin_metric_forbidden(client):
    r = client.patch("/evaluation-metrics/builtin.mean_ic", json={"description": "x"})
    assert r.status_code == 400
    assert "内置" in r.json()["detail"]


def test_delete_builtin_metric_forbidden(client):
    r = client.delete("/evaluation-metrics/builtin.mean_ic")
    assert r.status_code == 400
