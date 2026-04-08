from __future__ import annotations

import json

MIN_SOURCE = "x = 1\n"

_CALC = "evaluation_workflow_nodes.calculate_factor_value.CalculateFactorValueNode"
_LOAD = "evaluation_workflow_nodes.load_data_set.LoadDataSet"
_COLLECT = "evaluation_workflow_nodes.collect_result.CollectResult"


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


def _profile_workflow_with_data_set(ds_row_id: str) -> dict:
    return {
        "nodes": [
            {
                "id": "load",
                "type": _LOAD,
                "pos": [0, 0],
                "params": {"data_set": ds_row_id},
            },
            {
                "id": "calc",
                "type": _CALC,
                "pos": [200, 0],
                "params": {
                    "start_date": "2023-01-01",
                    "end_date": "2023-12-31",
                    "quantiles": 5,
                    "stock_codes": "",
                },
            },
            {
                "id": "collect",
                "type": _COLLECT,
                "pos": [400, 0],
                "params": {"result": [{"from_node": "calc", "from_socket": "clean_factor"}]},
            },
        ],
        "links": [
            {
                "from_node": "load",
                "from_socket": "data_set",
                "to_node": "calc",
                "to_socket": "data_set",
            },
            {
                "from_node": "calc",
                "from_socket": "clean_factor",
                "to_node": "collect",
                "to_socket": "result",
            },
        ],
    }


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


def test_data_sets_crud(client, workspace_tmp):
    csv_path = workspace_tmp / "eval_test_panel.csv"
    csv_path.write_text("date,asset,close\n2023-01-01,A,1\n", encoding="utf-8")

    r_ds = client.post("/datasources", json=_csv_datasource_body())
    assert r_ds.status_code == 200
    ds_id = r_ds.json()["id"]

    r0 = client.get("/data-sets")
    assert r0.status_code == 200
    assert r0.json() == []

    r_bad = client.post(
        "/data-sets",
        json={
            "name": "t1",
            "datasource_bindings": [
                {"datasource_id": "nonexistent", "dependencies": ["close"]},
            ],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "stock_codes": [],
        },
    )
    assert r_bad.status_code == 400

    r1 = client.post(
        "/data-sets",
        json={
            "name": "t1",
            "description": "d",
            "datasource_bindings": [{"datasource_id": ds_id, "dependencies": []}],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "stock_codes": ["A", "B"],
        },
    )
    assert r1.status_code == 200
    b1 = r1.json()
    row_id = b1["id"]
    assert b1["name"] == "t1"
    assert len(b1["datasource_bindings"]) == 1
    assert b1["datasource_bindings"][0]["datasource_name"]

    r2 = client.get("/data-sets")
    assert len(r2.json()) == 1

    r3 = client.patch(
        f"/data-sets/{row_id}",
        json={"name": "t1x"},
    )
    assert r3.status_code == 200
    assert r3.json()["name"] == "t1x"

    cfg = workspace_tmp / "data_sets" / "registry.json"
    assert cfg.is_file()
    data = json.loads(cfg.read_text(encoding="utf-8"))
    assert data["version"] == 2
    assert len(data["items"]) == 1

    r4 = client.delete(f"/data-sets/{row_id}")
    assert r4.status_code == 204
    assert client.get("/data-sets").json() == []


def test_evaluation_run_with_data_set_id(client, workspace_tmp, monkeypatch):
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
        "/data-sets",
        json={
            "name": "ts_run",
            "datasource_bindings": [{"datasource_id": ds_id, "dependencies": []}],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "stock_codes": [],
        },
    )
    assert r_ts.status_code == 200
    ds_row_id = r_ts.json()["id"]

    r_prof = client.post(
        "/evaluation-profiles",
        json={"name": "prof_ts", "workflow": _profile_workflow_with_data_set(ds_row_id)},
    )
    assert r_prof.status_code == 200
    prof_id = r_prof.json()["id"]

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
        f"/evaluation-profiles/{prof_id}/factors/{fid}/evaluations/run",
    )
    assert r_run.status_code == 200
    body = r_run.json()
    assert body["factor_id"] == fid
    assert (body.get("error") or "").strip() == ""
    assert body.get("results") is not None


def test_evaluation_run_empty_body_requires_data_set(client, workspace_tmp, monkeypatch):
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
        "/data-sets",
        json={
            "name": "ts_only",
            "datasource_bindings": [{"datasource_id": ds_id, "dependencies": []}],
            "start": "2023-01-01",
            "end": "2024-12-31",
            "stock_codes": [],
        },
    )
    assert r_ts.status_code == 200

    r_f = client.post(
        "/factors",
        json={
            "name": "f_no_ds_in_body",
            "max_window": 2,
            "dependencies": ["close"],
            "source": MIN_SOURCE,
        },
    )
    assert r_f.status_code == 200
    fid = r_f.json()["id"]

    r_prof = client.post(
        "/evaluation-profiles",
        json={"name": "prof_no_ds", "workflow": _profile_workflow_missing_data_set()},
    )
    assert r_prof.status_code == 200
    prof_id = r_prof.json()["id"]

    r_run = client.post(f"/evaluation-profiles/{prof_id}/factors/{fid}/evaluations/run")
    assert r_run.status_code == 400
    assert "数据集" in r_run.json()["detail"]
