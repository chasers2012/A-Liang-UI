from __future__ import annotations


def test_node_types_include_builtin_eval_metric_nodes(client):
    r = client.get("/evaluation/profile/node-types")
    assert r.status_code == 200
    types = {x["type"] for x in r.json()}
    assert any("mean_ic" in t for t in types)
    assert any("metric_builtin_mean_return_spread" in t for t in types)
