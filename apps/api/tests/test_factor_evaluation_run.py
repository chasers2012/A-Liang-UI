from __future__ import annotations

MIN_SOURCE = "x = 1\n"

_CALC = "evaluation_workflow_nodes.calculate_factor_value.CalculateFactorValueNode"


def _profile_workflow_missing_data_set() -> dict:
    return {
        "nodes": [
            {
                "id": "calc",
                "type": _CALC,
                "pos": [0, 0],
                "params": {
                    "start_date": "2023-01-01",
                    "end_date": "2024-12-31",
                    "quantiles": 5,
                    "stock_codes": "",
                },
            }
        ],
        "links": [],
    }


def test_evaluation_run_no_datasource(client):
    r = client.post(
        "/factors",
        json={
            "name": "f_run",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r.status_code == 200
    fid = r.json()["id"]

    r_p = client.post(
        "/evaluation-profiles",
        json={"name": "p_run", "workflow": _profile_workflow_missing_data_set()},
    )
    assert r_p.status_code == 200
    pid = r_p.json()["id"]

    r2 = client.post(f"/evaluation-profiles/{pid}/factors/{fid}/evaluations/run")
    assert r2.status_code == 400
    assert "数据集" in r2.json()["detail"]
