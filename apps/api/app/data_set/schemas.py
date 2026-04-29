from __future__ import annotations

import json
from typing import Any

from pydantic import ConfigDict, field_validator
from sqlmodel import Field, SQLModel
from workflow.schemas import WorkflowGraphPersisted

from app.common.id import create_id_generator
from app.data_set.constants import (
    PREPROCESSING_EMPTY_WORKFLOW,
    empty_preprocessing_workflow_dict,
)
from app.data_set.models import DataSetRow
from app.datasource.schemas import utc_now_iso

generate_id = create_id_generator("data_sets")

_EMPTY_WORKFLOW: dict[str, Any] = PREPROCESSING_EMPTY_WORKFLOW


def _normalize_preprocessing_workflow_dict(workflow: dict[str, Any]) -> dict[str, Any]:
    return WorkflowGraphPersisted.model_validate(workflow).model_dump(by_alias=True)


def _validate_preprocessing_workflow_dict(workflow: dict[str, Any]) -> None:
    if not isinstance(workflow.get("workflow_inputs"), list):
        raise ValueError("preprocessing_workflow 缺少 workflow_inputs")
    if not isinstance(workflow.get("workflow_outputs"), list):
        raise ValueError("preprocessing_workflow 缺少 workflow_outputs")
    nodes = workflow.get("nodes", [])
    if not isinstance(nodes, list):
        raise ValueError("preprocessing_workflow.nodes 必须是数组")
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_type = str(node.get("type", "")).strip()
        if not node_type:
            raise ValueError("preprocessing_workflow.nodes[].type 不能为空")


def _stored_workflow_str(v: object) -> str:
    """Normalize workflow for storage rows."""
    if isinstance(v, dict):
        _validate_preprocessing_workflow_dict(v)
        return json.dumps(_normalize_preprocessing_workflow_dict(dict(v)), ensure_ascii=False)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return json.dumps(empty_preprocessing_workflow_dict(), ensure_ascii=False)
        loaded = json.loads(s)
        if not isinstance(loaded, dict):
            raise TypeError("workflow 必须是 JSON 字符串（对象）")
        _validate_preprocessing_workflow_dict(loaded)
        return json.dumps(_normalize_preprocessing_workflow_dict(dict(loaded)), ensure_ascii=False)
    raise TypeError("workflow 必须是 JSON 对象或 JSON 字符串（对象）")


def workflow_public_dict(workflow_json: str) -> dict[str, Any]:
    """Parse stored workflow JSON string into an object for API responses."""
    raw = (workflow_json or "").strip()
    if not raw:
        return empty_preprocessing_workflow_dict()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("workflow 须为 JSON 对象")
    return _normalize_preprocessing_workflow_dict(data)


class DataSetDatasourceBindingStored(SQLModel):
    """Maps one datasource to the physical columns it should load."""

    datasource_id: str
    columns: list[str] = Field(default_factory=list)
    date_column: str = ""
    asset_column: str = ""


class DataSetDatasourceBindingInput(SQLModel):
    datasource_id: str
    columns: list[str] = Field(default_factory=list)
    date_column: str = ""
    asset_column: str = ""

    @field_validator("columns", mode="before")
    @classmethod
    def _strip_columns(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("columns must be a list")
        return [str(x).strip() for x in v if str(x).strip()]

    @field_validator("date_column", "asset_column", mode="before")
    @classmethod
    def _strip_index_cols(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class DataSetCreate(SQLModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    description: str = ""
    datasource_bindings: list[DataSetDatasourceBindingInput]
    preprocessing_workflow: dict[str, Any] = Field(
        default_factory=empty_preprocessing_workflow_dict
    )
    start: str
    end: str
    instrument_codes: list[str] = Field(default_factory=list)

    @field_validator("instrument_codes", mode="before")
    @classmethod
    def _strip_codes(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("instrument_codes must be a list")
        return [str(x).strip() for x in v if str(x).strip()]

    @field_validator("preprocessing_workflow", mode="before")
    @classmethod
    def _workflow_create(cls, v: object) -> dict[str, Any]:
        if v is None:
            wf = empty_preprocessing_workflow_dict()
            _validate_preprocessing_workflow_dict(wf)
            return wf
        if not isinstance(v, dict):
            raise TypeError("preprocessing_workflow 必须是 JSON 对象")
        _validate_preprocessing_workflow_dict(v)
        return _normalize_preprocessing_workflow_dict(v)

    def to_row(self) -> DataSetRow:
        now = utc_now_iso()
        rid = str(generate_id())
        bindings = [_binding_to_stored_dict(b) for b in self.datasource_bindings]
        _validate_preprocessing_workflow_dict(self.preprocessing_workflow)
        return DataSetRow(
            id=rid,
            name=self.name.strip(),
            description=(self.description or "").strip(),
            datasource_bindings=bindings,
            preprocessing_workflow=json.dumps(
                _normalize_preprocessing_workflow_dict(dict(self.preprocessing_workflow)),
                ensure_ascii=False,
            ),
            start=self.start.strip(),
            end=self.end.strip(),
            instrument_codes=[c.strip() for c in self.instrument_codes if str(c).strip()],
            created_at=now,
            updated_at=now,
        )


def _binding_to_stored_dict(
    binding: DataSetDatasourceBindingInput | DataSetDatasourceBindingStored,
) -> dict[str, Any]:
    return {
        "datasource_id": binding.datasource_id.strip(),
        "columns": [x.strip() for x in binding.columns if str(x).strip()],
        "date_column": binding.date_column.strip(),
        "asset_column": binding.asset_column.strip(),
    }


class DataSetPatch(SQLModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    datasource_bindings: list[DataSetDatasourceBindingInput] | None = None
    preprocessing_workflow: dict[str, Any] | None = None
    start: str | None = None
    end: str | None = None
    instrument_codes: list[str] | None = None


class DataSetDatasourceBindingPublic(SQLModel):
    datasource_id: str
    datasource_name: str
    datasource_type: str
    columns: list[str]
    date_column: str
    asset_column: str


class DataSetPublic(SQLModel):
    id: str
    name: str
    description: str
    datasource_bindings: list[DataSetDatasourceBindingPublic]
    preprocessing_workflow: dict[str, Any]
    start: str
    end: str
    instrument_codes: list[str]
    created_at: str
    updated_at: str


class DataSetPanelPreviewCsvResponse(SQLModel):
    """
    Raw CSV preview payload.

    Backend returns ``panel.to_csv()`` directly; the frontend parses and renders it.
    """

    csv: str
