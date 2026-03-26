from __future__ import annotations

MIN_SOURCE = "x = 1\n"


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

    r2 = client.post(f"/factors/{fid}/evaluations/run")
    assert r2.status_code == 400
    assert "数据源" in r2.json()["detail"]
