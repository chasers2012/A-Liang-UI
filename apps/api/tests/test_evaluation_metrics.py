from __future__ import annotations


def test_evaluation_metrics_crud(client):
    r = client.post("/evaluation-metrics", json={"name": "em_test"})
    assert r.status_code == 200
    data = r.json()
    mid = data["id"]
    assert data["name"] == "em_test"
    assert "UserEvaluationMetric" in data["source"]
    assert data.get("visualization") is not None
    assert data["visualization"]["mode"] == "auto"
    assert data["visualization"]["period_day_keys"] is False

    r2 = client.get(f"/evaluation-metrics/{mid}")
    assert r2.status_code == 200
    assert r2.json()["id"] == mid

    r3 = client.patch(
        f"/evaluation-metrics/{mid}",
        json={
            "description": "d1",
            "visualization": {"mode": "table", "period_day_keys": True},
        },
    )
    assert r3.status_code == 200
    body3 = r3.json()
    assert body3["description"] == "d1"
    assert body3["visualization"]["mode"] == "table"
    assert body3["visualization"]["period_day_keys"] is True

    r4 = client.delete(f"/evaluation-metrics/{mid}")
    assert r4.status_code == 204

    r5 = client.get(f"/evaluation-metrics/{mid}")
    assert r5.status_code == 404


def test_evaluation_profiles_node_types(client):
    r = client.get("/evaluation-profiles/node-types")
    assert r.status_code == 200
    types = {x["type"] for x in r.json()}
    assert "prepare_alphalens" in types
    assert "mean_information_coefficient" in types
