from __future__ import annotations


def test_evaluation_metrics_crud(client):
    r = client.post("/evaluation-metrics", json={"name": "em_test"})
    assert r.status_code == 200
    data = r.json()
    mid = data["id"]
    assert data["name"] == "em_test"
    assert "workflow_type_id" not in data
    assert data["source_path"].startswith("workflow_nodes/evaluation/em_")
    assert "NewEvaluationMetric" in data["source"]

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
                    "type": "string",
                    "default": "a",
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
    assert any("calculate_factor_value" in t for t in types)
    assert any(t.endswith(".EchartsLineNode") for t in types)
    assert any(t.endswith(".EchartsBarNode") for t in types)
    assert any(t.endswith(".EchartsScatterNode") for t in types)
    assert any(t.endswith(".EchartsPieNode") for t in types)
    assert any(t.endswith(".EchartsFunnelNode") for t in types)
    assert any(t.endswith(".MeanIC") for t in types)
    assert any(t.endswith(".BuiltinMeanReturnSpreadNode") for t in types)
    echarts_types = [x for x in types if "echarts_" in x]
    assert len(echarts_types) >= 18
    prep_row = next(x for x in rows if "CalculateFactorValueNode" in x["type"])
    assert len(prep_row["inputs"]) >= 2
    assert "node_category" not in prep_row
    assert "viz_mode" not in prep_row
    for row in rows:
        assert "inputs" in row
        assert isinstance(row["inputs"], list)
        assert "node_category" not in row
        assert "viz_mode" not in row
    line_row = next(x for x in rows if x["type"].endswith(".EchartsLineNode"))
    assert isinstance(line_row["inputs"], list)
