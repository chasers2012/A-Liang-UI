from __future__ import annotations


def test_list_evaluation_metrics_is_user_registry_only(client):
    r = client.get("/evaluation-metrics")
    assert r.status_code == 200
    for row in r.json():
        assert "id" in row
        assert "workflow_type_id" not in row


def test_node_types_include_builtin_eval_metric_nodes(client):
    r = client.get("/evaluation-profiles/node-types")
    assert r.status_code == 200
    types = {x["type"] for x in r.json()}
    assert any("metric_builtin_mean_ic" in t for t in types)
    assert any("metric_builtin_mean_return_spread" in t for t in types)
