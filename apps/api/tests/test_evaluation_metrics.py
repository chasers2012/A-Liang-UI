from __future__ import annotations


def test_evaluation_metrics_crud(client):
    r = client.post("/evaluation-metrics", json={"name": "em_test"})
    assert r.status_code == 200
    data = r.json()
    mid = data["id"]
    assert data["name"] == "em_test"
    assert data["workflow_type_id"] == f"user_metric_{mid.replace('-', '_')}"
    assert data["source_path"].startswith("workflow_nodes/evaluation/em_")
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
    assert "echarts_line" in types
    assert "echarts_bar" in types
    assert "builtin_mean_ic" in types
    assert "builtin_mean_return_spread" in types
    echarts_types = [x for x in types if x.startswith("echarts_")]
    assert len(echarts_types) == 2
    prep_row = next(x for x in rows if x["type"] == "prepare_alphalens")
    assert len(prep_row["workflow_parameters"]) >= 4
    assert "node_category" not in prep_row
    assert "viz_mode" not in prep_row
    for row in rows:
        assert "workflow_parameters" in row
        assert isinstance(row["workflow_parameters"], list)
        assert "node_category" not in row
        assert "viz_mode" not in row
    line_row = next(x for x in rows if x["type"] == "echarts_line")
    assert line_row["workflow_parameters"] == []
    builtin_row = next(x for x in rows if x["type"] == "builtin_mean_ic")
    assert builtin_row.get("metric_id") == "builtin_mean_ic"
