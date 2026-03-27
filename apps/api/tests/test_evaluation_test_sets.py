from __future__ import annotations

import json

MIN_SOURCE = "x = 1\n"


def _csv_datasource_body(name: str = "ds_csv") -> dict:
    return {
        "name": name,
        "type": "csv",
        "enabled": True,
        "csv": {
            "path": "eval_test_panel.csv",
            "date_column": "date",
            "asset_column": "asset",
            "read_csv_kwargs": {},
        },
    }


def test_evaluation_test_sets_crud(client, workspace_tmp):
    csv_path = workspace_tmp / "eval_test_panel.csv"
    csv_path.write_text("date,asset,close\n2023-01-01,A,1\n", encoding="utf-8")

    r_ds = client.post("/datasources", json=_csv_datasource_body())
    assert r_ds.status_code == 200
    ds_id = r_ds.json()["id"]

    r0 = client.get("/evaluation-test-sets")
    assert r0.status_code == 200
    assert r0.json() == []

    r_bad = client.post(
        "/evaluation-test-sets",
        json={
            "name": "t1",
            "datasource_bindings": [
                {"datasource_id": "nonexistent", "dependencies": ["close"]},
            ],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "stock_codes": [],
            "is_default": False,
        },
    )
    assert r_bad.status_code == 400

    r1 = client.post(
        "/evaluation-test-sets",
        json={
            "name": "t1",
            "description": "d",
            "datasource_bindings": [{"datasource_id": ds_id, "dependencies": []}],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "stock_codes": ["A", "B"],
            "is_default": True,
        },
    )
    assert r1.status_code == 200
    b1 = r1.json()
    ts_id = b1["id"]
    assert b1["name"] == "t1"
    assert len(b1["datasource_bindings"]) == 1
    assert b1["datasource_bindings"][0]["datasource_name"]
    assert b1["is_default"] is True

    r2 = client.get("/evaluation-test-sets")
    assert len(r2.json()) == 1

    r3 = client.patch(
        f"/evaluation-test-sets/{ts_id}",
        json={"name": "t1x"},
    )
    assert r3.status_code == 200
    assert r3.json()["name"] == "t1x"

    cfg = workspace_tmp / "config" / "evaluation_test_sets.json"
    assert cfg.is_file()
    data = json.loads(cfg.read_text(encoding="utf-8"))
    assert data["version"] == 2
    assert len(data["items"]) == 1

    r4 = client.delete(f"/evaluation-test-sets/{ts_id}")
    assert r4.status_code == 204
    assert client.get("/evaluation-test-sets").json() == []


def test_evaluation_run_with_test_set_id(client, workspace_tmp, monkeypatch):
    monkeypatch.delenv("FACTOR_AGENT_EVAL_START", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_EVAL_END", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_START_DATE", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_END_DATE", raising=False)

    csv_path = workspace_tmp / "eval_test_panel.csv"
    csv_path.write_text("date,asset,close\n2023-01-01,A,1\n", encoding="utf-8")
    r_ds = client.post("/datasources", json=_csv_datasource_body())
    assert r_ds.status_code == 200
    ds_id = r_ds.json()["id"]

    r_ts = client.post(
        "/evaluation-test-sets",
        json={
            "name": "ts_run",
            "datasource_bindings": [{"datasource_id": ds_id, "dependencies": []}],
            "start": "2099-01-01",
            "end": "2099-12-31",
            "stock_codes": [],
            "is_default": False,
        },
    )
    assert r_ts.status_code == 200
    ts_id = r_ts.json()["id"]

    r_f = client.post(
        "/factors",
        json={
            "name": "f_ts",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r_f.status_code == 200
    fid = r_f.json()["id"]

    r_run = client.post(
        f"/factors/{fid}/evaluations/run",
        json={"test_set_id": ts_id},
    )
    assert r_run.status_code == 200
    body = r_run.json()
    assert body["factor_id"] == fid
    assert body["window"] == {"start": "2099-01-01", "end": "2099-12-31"}


def test_evaluation_run_no_body_still_ok(client, workspace_tmp, monkeypatch):
    monkeypatch.delenv("FACTOR_AGENT_EVAL_START", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_EVAL_END", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_START_DATE", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_END_DATE", raising=False)

    csv_path = workspace_tmp / "eval_test_panel.csv"
    csv_path.write_text("date,asset,close\n2023-01-01,A,1\n", encoding="utf-8")
    client.post("/datasources", json=_csv_datasource_body())
    assert True

    r_f = client.post(
        "/factors",
        json={
            "name": "f_legacy",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r_f.status_code == 200
    fid = r_f.json()["id"]

    r_run = client.post(f"/factors/{fid}/evaluations/run")
    assert r_run.status_code == 200
    body = r_run.json()
    assert body["factor_id"] == fid
    assert body["window"] == {"start": "2023-01-01", "end": "2024-12-31"}


def test_migrate_v1_file_on_load(client, workspace_tmp):
    cfg_dir = workspace_tmp / "config"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    ds_id = "fake-ds"
    (cfg_dir / "evaluation_test_sets.json").write_text(
        json.dumps(
            {
                "version": 1,
                "items": [
                    {
                        "id": "ts-1",
                        "name": "legacy",
                        "description": "",
                        "datasource_id": ds_id,
                        "start": "2020-01-01",
                        "end": "2020-12-31",
                        "stock_codes": [],
                        "quantiles": 5,
                        "is_default": False,
                        "created_at": "2020-01-01T00:00:00+00:00",
                        "updated_at": "2020-01-01T00:00:00+00:00",
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    r = client.get("/evaluation-test-sets")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["datasource_bindings"][0]["datasource_id"] == ds_id
    assert rows[0]["datasource_bindings"][0]["dependencies"] == []
