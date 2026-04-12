from __future__ import annotations

from workflow import workflow_node_type_key
from workflow.node_loader import WorkflowNodeLoader
from workflow.parser import Parser

from app.common.datetime_utils import utc_now_iso
from app.nodes.package_manager import WorkflowNodePackageManager
from app.nodes.registry import WorkflowNodesRegistry
from app.nodes.schemas import (
    WorkflowNodeCreate,
    WorkflowNodeDetailPublic,
    WorkflowNodePatch,
    WorkflowNodeRecord,
    WorkflowNodeSummaryPublic,
)


def create_workflow_node(
    body: WorkflowNodeCreate, id_name: str | None = None
) -> WorkflowNodeRecord:
    nid = WorkflowNodesRegistry.generate_id(id_name)
    if id_name and WorkflowNodesRegistry.get_item(nid) is not None:
        raise ValueError(f"Workflow node {id_name} already exists")
    now = utc_now_iso()
    rec = body.to_record(nid, now, WorkflowNodePackageManager.get_source_path(nid))
    WorkflowNodePackageManager.write_node_package(nid, body.source)
    WorkflowNodesRegistry.add_item(rec)
    return rec


def _to_summary(rec: WorkflowNodeRecord) -> WorkflowNodeSummaryPublic:
    source = WorkflowNodesRegistry.read_source(rec)
    node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(source)
    type_key = getattr(node_cls, "type", "") or workflow_node_type_key(node_cls)
    category_raw = getattr(node_cls, "category", None)
    category = category_raw.strip() or None if isinstance(category_raw, str) else None
    return WorkflowNodeSummaryPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        type=type_key,
        category=category,
        entry=getattr(node_cls, "entry", "execute"),
        inputs=[Parser.serialize_socket(s) for s in node_cls.inputs],
        outputs=[Parser.serialize_socket(s) for s in node_cls.outputs],
    )


def load_node(node_id: str) -> WorkflowNodeSummaryPublic | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    return _to_summary(rec)


def load_node_detail(node_id: str) -> WorkflowNodeDetailPublic | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    summary = _to_summary(rec)
    return WorkflowNodeDetailPublic(
        **summary.model_dump(), source=WorkflowNodesRegistry.read_source(rec)
    )


def list_node_records() -> list[WorkflowNodeRecord]:
    return WorkflowNodesRegistry.list_items()


def list_nodes() -> list[WorkflowNodeSummaryPublic]:
    out: list[WorkflowNodeSummaryPublic] = []
    for rec in list_node_records():
        out.append(_to_summary(rec))
    return out


def get_node_record(node_id: str) -> WorkflowNodeRecord | None:
    return WorkflowNodesRegistry.get_item(node_id)


def read_node_source(rec: WorkflowNodeRecord) -> str:
    return WorkflowNodesRegistry.read_source(rec)


def write_node_source(rec: WorkflowNodeRecord, source: str) -> None:
    WorkflowNodesRegistry.write_source(rec, source)


def update_node_record(node_id: str, apply_fn) -> WorkflowNodeRecord | None:
    return WorkflowNodesRegistry.update_item(node_id, apply_fn)


def delete_workflow_node(node_id: str) -> WorkflowNodeRecord | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    WorkflowNodePackageManager.delete_node_package(node_id)
    return WorkflowNodesRegistry.delete_item(node_id)


def apply_node_patch(rec: WorkflowNodeRecord, patch: WorkflowNodePatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "source" in data and patch.source is not None:
        write_node_source(rec, patch.source)
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(patch.source)
        rec.name = getattr(node_cls, "label", rec.name)
        rec.description = getattr(node_cls, "description", rec.description) or ""
    rec.updated_at = utc_now_iso()
