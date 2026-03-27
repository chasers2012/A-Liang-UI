from __future__ import annotations

import json

MIN_SOURCE = "x = 1\n"


def test_evaluations_summary_empty_registry(client):
    r = client.get("/factors/evaluations/summary")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["aggregate"]["total_factors"] == 0
    assert body["aggregate"]["evaluated_count"] == 0
    assert body["aggregate"]["unevaluated_count"] == 0
    assert body["aggregate"]["mean_ic_primary_avg"] is None
    assert body["rows"] == []


def test_evaluations_summary_partial_and_aggregate(workspace_tmp, client):
    r = client.post(
        "/factors",
        json={
            "name": "f_a",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r.status_code == 200
    id_a = r.json()["id"]

    r = client.post(
        "/factors",
        json={
            "name": "f_b",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r.status_code == 200
    id_b = r.json()["id"]

    eval_path = workspace_tmp / "config" / "factor_evaluations.json"
    eval_path.write_text(
        json.dumps(
            {
                "version": 1,
                "items": {
                    id_a: {
                        "evaluated_at": "2025-03-26T12:00:00+00:00",
                        "window": {"start": "2020-01-01", "end": "2024-12-31"},
                        "mean_ic": {"1": 0.01, "5": 0.04},
                        "mean_return_spread": {"5": 0.001},
                        "error": None,
                    },
                    id_b: {
                        "evaluated_at": "2025-03-26T13:00:00+00:00",
                        "mean_ic": {},
                        "error": "Alphalens failed",
                    },
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    r2 = client.get("/factors/evaluations/summary")
    assert r2.status_code == 200, r2.text
    body = r2.json()
    agg = body["aggregate"]
    assert agg["total_factors"] == 2
    assert agg["evaluated_count"] == 1
    assert agg["unevaluated_count"] == 1
    assert agg["primary_period"] == "5"
    assert agg["mean_ic_primary_avg"] == 0.04

    rows = {row["factor_id"]: row for row in body["rows"]}
    assert rows[id_a]["has_evaluation"] is True
    assert rows[id_a]["error"] is None
    assert rows[id_a]["mean_ic"]["5"] == 0.04
    assert rows[id_b]["has_evaluation"] is True
    assert rows[id_b]["error"] == "Alphalens failed"


def test_evaluations_summary_invalid_json(workspace_tmp, client):
    cfg = workspace_tmp / "config"
    cfg.mkdir(parents=True, exist_ok=True)
    p = cfg / "factor_evaluations.json"
    p.write_text("{not json", encoding="utf-8")
    r = client.get("/factors/evaluations/summary")
    assert r.status_code == 500
