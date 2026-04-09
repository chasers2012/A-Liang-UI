from __future__ import annotations

from datetime import date, timedelta

from app.persistence.models import DataSetRow
from app.persistence.sqlite_db import get_session
from sqlmodel import select

MIN_SOURCE = "x = 1\n"

_CALC = "evaluation_workflow_nodes.calculate_factor_value.CalculateFactorValueNode"
_LOAD = "evaluation_workflow_nodes.load_data_set.LoadDataSet"
_COLLECT = "evaluation_workflow_nodes.collect_result.CollectResult"


def _factor_source_for_name(name: str) -> str:
    return f'''from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class EvalWorkflowFactor(Factor):
    name = "{name}"
    group = "g"
    description = ""
    dependencies = ["close"]
    max_window = 2

    def calc(self, data: pd.DataFrame) -> pd.Series:
        return data["close"]
'''


def _profile_workflow_missing_data_set() -> dict:
    return {
        "nodes": [
            {
                "id": "calc",
                "type": _CALC,
                "pos": [0, 0],
                "params": {
                    "quantiles": 5,
                    "max_loss": 1.0,
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
                    "quantiles": 5,
                    "max_loss": 1.0,
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
        "config": {
            "path": "eval_test_panel.csv",
            "read_csv_kwargs": {},
        },
    }


def _ds_binding(datasource_id: str, dependencies: list[str] | None = None) -> dict:
    return {
        "datasource_id": datasource_id,
        "dependencies": list(dependencies or []),
        "date_column": "date",
        "asset_column": "asset",
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
            "datasource_bindings": [_ds_binding("nonexistent", ["close"])],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "instrument_codes": [],
        },
    )
    assert r_bad.status_code == 400

    r1 = client.post(
        "/data-sets",
        json={
            "name": "t1",
            "description": "d",
            "datasource_bindings": [_ds_binding(ds_id, [])],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "instrument_codes": ["A", "B"],
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

    with get_session() as session:
        rows = list(session.exec(select(DataSetRow)))
    assert len(rows) == 1
    assert rows[0].id == row_id

    r4 = client.delete(f"/data-sets/{row_id}")
    assert r4.status_code == 204
    assert client.get("/data-sets").json() == []


def test_evaluation_run_with_data_set_id(client, workspace_tmp, monkeypatch):
    monkeypatch.delenv("FACTOR_AGENT_EVAL_START", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_EVAL_END", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_START_DATE", raising=False)
    monkeypatch.delenv("FACTOR_AGENT_END_DATE", raising=False)

    csv_path = workspace_tmp / "eval_test_panel.csv"
    lines = ["date,asset,close"]
    d0 = date(2023, 1, 3)
    for i in range(45):
        lines.append(f"{(d0 + timedelta(days=i)).isoformat()},A,{10.0 + i * 0.02}")
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    r_ds = client.post("/datasources", json=_csv_datasource_body())
    assert r_ds.status_code == 200
    ds_id = r_ds.json()["id"]

    r_ts = client.post(
        "/data-sets",
        json={
            "name": "ts_run",
            "datasource_bindings": [_ds_binding(ds_id, ["close"])],
            "start": "2023-01-01",
            "end": "2023-12-31",
            "instrument_codes": ["A"],
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
            "source": _factor_source_for_name("f_ts"),
        },
    )
    assert r_f.status_code == 200
    fid = r_f.json()["id"]

    r_run = client.post(
        "/evaluation-profiles/evaluations/run",
        json={"profile_id": prof_id, "factor_id": fid},
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
            "datasource_bindings": [_ds_binding(ds_id, ["close"])],
            "start": "2023-01-01",
            "end": "2024-12-31",
            "instrument_codes": [],
        },
    )
    assert r_ts.status_code == 200

    r_f = client.post(
        "/factors",
        json={
            "name": "f_no_ds_in_body",
            "max_window": 2,
            "dependencies": ["close"],
            "source": _factor_source_for_name("f_no_ds_in_body"),
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

    r_run = client.post(
        "/evaluation-profiles/evaluations/run",
        json={"profile_id": prof_id, "factor_id": fid},
    )
    assert r_run.status_code == 200
    assert "数据集" in (r_run.json().get("error") or "")
