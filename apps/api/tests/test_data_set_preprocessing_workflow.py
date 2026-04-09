from __future__ import annotations

import json

from app.data_set.controller import get_data_set


def _csv_datasource_body(name: str = "ds_csv") -> dict:
    return {
        "name": name,
        "type": "csv",
        "config": {
            "path": "eval_test_panel_pp.csv",
            "read_csv_kwargs": {},
        },
    }


def _ds_binding(datasource_id: str) -> dict:
    return {
        "datasource_id": datasource_id,
        "dependencies": ["close"],
        "date_column": "date",
        "asset_column": "asset",
    }


def _preprocessor_mul_close_source() -> str:
    # Multiply physical column "close" by config.k
    return """from __future__ import annotations

from typing import Any

import pandas as pd

from factor.preprocess import DataPreprocessorBase


class MulClose(DataPreprocessorBase):
    name = "MulClose"
    description = "multiply close by k"

    def transform(self, frames: dict[str, pd.DataFrame], *, config: dict[str, Any]) -> dict[str, pd.DataFrame]:
        k = config.get("k", 2)
        out: dict[str, pd.DataFrame] = {}
        for key, df in frames.items():
            df2 = df.copy()
            if "close" in df2.columns:
                df2["close"] = df2["close"] * k
            out[key] = df2
        return out
"""


def _preprocessing_workflow(preprocessor_type: str) -> dict:
    INPUT_FRAMES_TYPE = "factor.preprocessing_workflow_nodes.DataSetFramesInput"
    COLLECT_FRAMES_TYPE = "factor.preprocessing_workflow_nodes.CollectFrames"
    RAW_FRAMES_VALUE_TYPE = "raw_frames"

    return {
        "nodes": [
            {
                "id": "frames_input",
                "type": INPUT_FRAMES_TYPE,
                "pos": [0, 0],
                "label": "原始 frames 输入",
                "category": "data_set_preprocess",
                "inputs": [],
                "outputs": [
                    {
                        "name": "frames",
                        "required": True,
                        "value_type": RAW_FRAMES_VALUE_TYPE,
                    }
                ],
                "params": {},
            },
            {
                "id": "pp_node",
                "type": preprocessor_type,
                "pos": [200, 0],
                "label": "preprocessor node",
                "category": "data_set_preprocess",
                "inputs": [
                    {
                        "name": "frames",
                        "required": True,
                        "value_type": RAW_FRAMES_VALUE_TYPE,
                    },
                    {
                        "name": "config_json",
                        "required": False,
                        "value_type": "string",
                        "render_type": "input",
                    },
                    {
                        "name": "datasource_ids_csv",
                        "required": False,
                        "value_type": "string",
                        "render_type": "input",
                    },
                ],
                "outputs": [
                    {
                        "name": "frames",
                        "required": False,
                        "value_type": RAW_FRAMES_VALUE_TYPE,
                    }
                ],
                "params": {
                    "config_json": json.dumps({"k": 2}),
                    "datasource_ids_csv": "",
                },
            },
            {
                "id": "collect_frames",
                "type": COLLECT_FRAMES_TYPE,
                "pos": [420, 0],
                "label": "预处理结果收集",
                "category": "data_set_preprocess",
                "inputs": [
                    {
                        "name": "frames",
                        "required": True,
                        "value_type": RAW_FRAMES_VALUE_TYPE,
                    }
                ],
                "outputs": [
                    {
                        "name": "frames",
                        "required": False,
                        "value_type": RAW_FRAMES_VALUE_TYPE,
                    }
                ],
                "params": {},
            },
        ],
        "links": [
            {
                "from_node": "frames_input",
                "from_socket": "frames",
                "to_node": "pp_node",
                "to_socket": "frames",
            },
            {
                "from_node": "pp_node",
                "from_socket": "frames",
                "to_node": "collect_frames",
                "to_socket": "frames",
            },
        ],
    }


def test_data_set_preprocessing_workflow_applies_to_panel(
    client,
    workspace_tmp,
):
    csv_path = workspace_tmp / "eval_test_panel_pp.csv"
    csv_path.write_text(
        "date,asset,close\n2023-01-01,A,10\n2023-01-02,A,11\n",
        encoding="utf-8",
    )

    r_ds = client.post("/datasources", json=_csv_datasource_body())
    assert r_ds.status_code == 200
    ds_id = r_ds.json()["id"]

    r_pp = client.post(
        "/preprocessors",
        json={"source": _preprocessor_mul_close_source()},
    )
    assert r_pp.status_code == 200
    pp_id = r_pp.json()["id"]

    # Ensure wrapper node registration for newly-created preprocessor.
    r_types = client.get("/preprocessors/node-types")
    assert r_types.status_code == 200
    types = {x["type"] for x in r_types.json()}
    assert pp_id in types

    r_data_set = client.post(
        "/data-sets",
        json={
            "name": "ds_pp",
            "datasource_bindings": [_ds_binding(ds_id)],
            "preprocessing_workflow": _preprocessing_workflow(pp_id),
            "start": "2023-01-01",
            "end": "2023-12-31",
            "instrument_codes": [],
        },
    )
    assert r_data_set.status_code == 200
    data_set_id = r_data_set.json()["id"]

    data_set = get_data_set(data_set_id)
    assert data_set is not None

    panel = data_set.get_panel(fields=["close"], window=0)
    # panel sorted by index; pick first row value.
    actual = float(panel.reset_index()["close"].iloc[0])
    assert actual == 20.0
