from __future__ import annotations

import json
from typing import Any

from factor.preprocessing_workflow_nodes import CollectFrames, DataSetFramesInput
from pydantic import BaseModel, ConfigDict, Field, field_validator
from workflow.parser import Parser

from app.common.id import create_id_generator
from app.datasource.schemas import utc_now_iso

generate_id = create_id_generator("data_sets")

_EMPTY_WORKFLOW: dict[str, Any] = {"nodes": [], "links": []}
_INPUT_FRAMES_TYPE = DataSetFramesInput.type
_COLLECT_FRAMES_TYPE = CollectFrames.type


def _system_node_payload(
    *,
    node_cls: type,
    node_id: str,
    position: list[int],
) -> dict[str, Any]:
    inputs = [Parser.serialize_socket(socket) for socket in getattr(node_cls, "inputs", [])]
    outputs = [Parser.serialize_socket(socket) for socket in getattr(node_cls, "outputs", [])]
    return {
        "id": node_id,
        "type": getattr(node_cls, "type", ""),
        "label": getattr(node_cls, "label", ""),
        "category": getattr(node_cls, "category", ""),
        "inputs": inputs,
        "outputs": outputs,
        "pos": position,
        "params": {},
    }


def _next_available_node_id(*, preferred: str, taken_ids: set[str]) -> str:
    if preferred not in taken_ids:
        return preferred
    candidate_index = 1
    while True:
        candidate = f"{preferred}_{candidate_index}"
        if candidate not in taken_ids:
            return candidate
        candidate_index += 1


def _ensure_system_preprocessing_nodes(workflow: dict[str, Any]) -> dict[str, Any]:
    nodes_payload = workflow.get("nodes", [])
    links_payload = workflow.get("links", [])
    nodes: list[dict[str, Any]] = [n for n in nodes_payload if isinstance(n, dict)]
    links: list[dict[str, Any]] = [
        link_item for link_item in links_payload if isinstance(link_item, dict)
    ]
    taken_ids = {
        str(node_id).strip()
        for node in nodes
        if (node_id := node.get("id")) is not None and str(node_id).strip()
    }

    has_input_frames = any(node.get("type") == _INPUT_FRAMES_TYPE for node in nodes)
    has_collect_frames = any(node.get("type") == _COLLECT_FRAMES_TYPE for node in nodes)

    if not has_input_frames:
        input_node_id = _next_available_node_id(preferred="frames_input", taken_ids=taken_ids)
        taken_ids.add(input_node_id)
        nodes.append(
            _system_node_payload(
                node_cls=DataSetFramesInput,
                node_id=input_node_id,
                position=[0, 0],
            )
        )

    if not has_collect_frames:
        collect_node_id = _next_available_node_id(
            preferred="collect_frames",
            taken_ids=taken_ids,
        )
        nodes.append(
            _system_node_payload(
                node_cls=CollectFrames,
                node_id=collect_node_id,
                position=[360, 0],
            )
        )

    return {"nodes": nodes, "links": links}


def _stored_workflow_str(v: object) -> str:
    """Normalize workflow for :class:`DataSetRecord` (disk / in-memory record)."""
    if isinstance(v, str):
        s = v.strip()
        if not s:
            normalized = _ensure_system_preprocessing_nodes(dict(_EMPTY_WORKFLOW))
            return json.dumps(normalized, ensure_ascii=False)
        loaded = json.loads(s)
        if not isinstance(loaded, dict):
            raise TypeError("workflow 必须是 JSON 字符串或对象")
        normalized = _ensure_system_preprocessing_nodes(dict(loaded))
        return json.dumps(normalized, ensure_ascii=False)
    if isinstance(v, dict):
        normalized = _ensure_system_preprocessing_nodes(dict(v))
        return json.dumps(normalized, ensure_ascii=False)
    raise TypeError("workflow 必须是 JSON 字符串或对象")


def workflow_public_dict(workflow_json: str) -> dict[str, Any]:
    """Parse stored workflow JSON string into an object for API responses."""
    raw = (workflow_json or "").strip()
    if not raw:
        return dict(_EMPTY_WORKFLOW)
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("workflow 须为 JSON 对象")
    return data


class DataSetDatasourceBindingStored(BaseModel):
    """Maps one datasource to the logical dependency fields it provides."""

    datasource_id: str
    dependencies: list[str] = Field(default_factory=list)
    alias: dict[str, str] | None = None
    date_column: str = ""
    asset_column: str = ""


class DataSetRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str = ""
    datasource_bindings: list[DataSetDatasourceBindingStored] = Field(default_factory=list)
    preprocessing_workflow: str = ""
    start: str
    end: str
    instrument_codes: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str

    @field_validator("preprocessing_workflow", mode="before")
    @classmethod
    def _workflow_record(cls, v: object) -> str:
        return _stored_workflow_str(v)


class DataSetDatasourceBindingInput(BaseModel):
    datasource_id: str
    dependencies: list[str] = Field(default_factory=list)
    alias: dict[str, str] | None = None
    date_column: str = ""
    asset_column: str = ""

    @field_validator("dependencies", mode="before")
    @classmethod
    def _strip_deps(cls, v: object) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise TypeError("dependencies must be a list")
        return [str(x).strip() for x in v if str(x).strip()]

    @field_validator("alias", mode="before")
    @classmethod
    def _normalize_alias(cls, v: object) -> dict[str, str] | None:
        if v is None:
            return None
        if not isinstance(v, dict):
            raise TypeError("alias must be a dict")
        out: dict[str, str] = {}
        for k, val in v.items():
            kk = str(k).strip()
            vv = str(val).strip()
            if not kk or not vv:
                continue
            out[kk] = vv
        return out or None

    @field_validator("date_column", "asset_column", mode="before")
    @classmethod
    def _strip_index_cols(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class DataSetCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    description: str = ""
    datasource_bindings: list[DataSetDatasourceBindingInput]
    preprocessing_workflow: dict[str, Any] = Field(default_factory=lambda: dict(_EMPTY_WORKFLOW))
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

    def to_record(self) -> DataSetRecord:
        now = utc_now_iso()
        rid = str(generate_id())
        bindings = [
            DataSetDatasourceBindingStored(
                datasource_id=b.datasource_id.strip(),
                dependencies=list(b.dependencies),
                alias=(dict(b.alias) if b.alias else None),
                date_column=b.date_column.strip(),
                asset_column=b.asset_column.strip(),
            )
            for b in self.datasource_bindings
        ]
        return DataSetRecord(
            id=rid,
            name=self.name.strip(),
            description=(self.description or "").strip(),
            datasource_bindings=bindings,
            preprocessing_workflow=_stored_workflow_str(self.preprocessing_workflow),
            start=self.start.strip(),
            end=self.end.strip(),
            instrument_codes=[c.strip() for c in self.instrument_codes if str(c).strip()],
            created_at=now,
            updated_at=now,
        )


class DataSetPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    datasource_bindings: list[DataSetDatasourceBindingInput] | None = None
    preprocessing_workflow: dict[str, Any] | None = None
    start: str | None = None
    end: str | None = None
    instrument_codes: list[str] | None = None


class DataSetDatasourceBindingPublic(BaseModel):
    datasource_id: str
    datasource_name: str
    datasource_type: str
    dependencies: list[str]
    alias: dict[str, str] | None = None
    date_column: str
    asset_column: str


class DataSetPublic(BaseModel):
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
