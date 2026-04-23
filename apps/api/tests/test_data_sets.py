from __future__ import annotations

from app.data_set.models import DataSetRow
from app.evaluation.profile.constants import EVALUATION_WORKFLOW_INPUTS
from app.persistence.sqlite_db import get_session
from sqlmodel import select

MIN_SOURCE = "x = 1\n"

_LOAD = "common_nodes.load_data_set.LoadDataSet"


def _factor_source_for_name(name: str) -> str:
    return f'''from __future__ import annotations

import pandas as pd
from factor.factor import Factor


class EvalWorkflowFactor(Factor):
    name = "{name}"
    group = "g"
    description = ""
    window = 1

    def calc(self, close: pd.DataFrame) -> pd.Series:
        return close.stack()
'''


def _profile_workflow_missing_data_set() -> dict:
    return {
        "workflow_inputs": [],
        "workflow_outputs": [
            {
                "name": "result",
                "required": False,
                "value_type": "scalar_json",
                "render_type": "appendable",
            }
        ],
        "nodes": [],
        "links": [],
    }


def _profile_workflow_with_data_set(ds_row_id: str) -> dict:
    return {
        "workflow_inputs": EVALUATION_WORKFLOW_INPUTS,
        "workflow_outputs": [
            {
                "name": "result",
                "required": False,
                "value_type": "scalar_json",
                "render_type": "appendable",
            }
        ],
        "nodes": [
            {
                "id": "load",
                "type": _LOAD,
                "pos": [0, 0],
                "params": {"data_set": ds_row_id},
            }
        ],
        "links": [
            {
                "from": {"kind": "workflow_input", "socket": "data_set"},
                "to": {"kind": "node", "node_id": "load", "socket": "data_set"},
            }
        ],
    }


def _csv_datasource_body(name: str = "ds_csv") -> dict:
    return {
        "name": name,
        "type": "csv",
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
