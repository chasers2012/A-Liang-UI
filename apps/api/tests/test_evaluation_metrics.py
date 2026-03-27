from __future__ import annotations


def test_evaluation_metrics_crud(client):
    r = client.post("/evaluation-metrics", json={"name": "em_test"})
    assert r.status_code == 200
    data = r.json()
    mid = data["id"]
    assert data["name"] == "em_test"
    assert "UserEvaluationMetric" in data["source"]
    assert data.get("visualization") is None

    r2 = client.get(f"/evaluation-metrics/{mid}")
    assert r2.status_code == 200
    assert r2.json()["id"] == mid

    r3 = client.patch(
        f"/evaluation-metrics/{mid}",
        json={"description": "d1"},
    )
    assert r3.status_code == 200
    body3 = r3.json()
    assert body3["description"] == "d1"
    assert body3.get("visualization") is None

    r4 = client.delete(f"/evaluation-metrics/{mid}")
    assert r4.status_code == 204

    r5 = client.get(f"/evaluation-metrics/{mid}")
    assert r5.status_code == 404


def test_evaluation_metric_workflow_parameters_patch(client):
    r = client.post("/evaluation-metrics", json={"name": "em_wp"})
    assert r.status_code == 200
    mid = r.json()["id"]
    r2 = client.patch(
        f"/evaluation-metrics/{mid}",
        json={
            "workflow_parameters": [
                {
                    "key": "alpha",
                    "label": "α",
                    "type": "number",
                    "default": 1.5,
                    "minimum": 0,
                    "maximum": 10,
                },
                {
                    "key": "mode",
                    "label": "模式",
                    "type": "enum",
                    "default": "a",
                    "enum_values": ["a", "b"],
                },
            ],
        },
    )
    assert r2.status_code == 200
    body = r2.json()
    assert len(body["workflow_parameters"]) == 2
    assert body["workflow_parameters"][0]["key"] == "alpha"

    r_bad = client.patch(
        f"/evaluation-metrics/{mid}",
        json={"workflow_parameters": [{"key": "quantiles", "type": "number"}]},
    )
    assert r_bad.status_code == 422


def test_evaluation_profiles_node_types(client):
    r = client.get("/evaluation-profiles/node-types")
    assert r.status_code == 200
    rows = r.json()
    types = {x["type"] for x in rows}
    assert "prepare_alphalens" in types
    assert "viz_auto" in types
    assert "viz_table" in types
    assert "metric:builtin.mean_ic" in types
    viz_types = [x for x in types if x.startswith("viz_")]
    assert len(viz_types) == 6
    prep_row = next(x for x in rows if x["type"] == "prepare_alphalens")
    assert len(prep_row["workflow_parameters"]) >= 4
    for row in rows:
        assert "workflow_parameters" in row
        assert isinstance(row["workflow_parameters"], list)
