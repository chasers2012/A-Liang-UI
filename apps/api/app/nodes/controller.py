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
    WorkflowNodeSummaryPublic,
)
from app.persistence.models import WorkflowNodeRow
from app.visibility.registry import WorkflowDomainNodesRegistry


def create_workflow_node(body: WorkflowNodeCreate, id_name: str | None = None) -> WorkflowNodeRow:
    nid = WorkflowNodesRegistry.generate_id(id_name)
    if id_name and WorkflowNodesRegistry.get_item(nid) is not None:
        raise ValueError(f"Workflow node {id_name} already exists")
    now = utc_now_iso()
    rec = body.to_record(nid, now, WorkflowNodePackageManager.get_source_path(nid))
    WorkflowNodePackageManager.write_node_package(nid, body.source)
    WorkflowNodesRegistry.add_item(rec)
    return rec


def _node_cls_to_summary(rec: WorkflowNodeRow, node_cls: type) -> WorkflowNodeSummaryPublic:
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


def _to_summary(rec: WorkflowNodeRow) -> WorkflowNodeSummaryPublic:
    node_cls = WorkflowNodesRegistry.resolve_node_class(rec)
    return _node_cls_to_summary(rec, node_cls)


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


def list_node_records() -> list[WorkflowNodeRow]:
    return WorkflowNodesRegistry.list_items()


def list_nodes() -> list[WorkflowNodeSummaryPublic]:
    return [_to_summary(rec) for rec in list_node_records()]


def list_nodes_by_domain(domain: str) -> list[WorkflowNodeSummaryPublic]:
    """
    List nodes usable in a given domain.

    Behavior matches WorkflowDomainNodesRegistry:
    - If the domain is not configured, all nodes are allowed.
    - Otherwise, only configured node ids are blocked (blacklist).
    """
    hidden_ids = WorkflowDomainNodesRegistry.get_hidden_node_ids(domain)
    if hidden_ids is None:
        return list_nodes()

    db_recs = list_node_records()
    out: list[WorkflowNodeSummaryPublic] = []
    for rec in db_recs:
        if rec.id in hidden_ids:
            continue
        out.append(_to_summary(rec))
    return out


def get_node_record(node_id: str) -> WorkflowNodeRow | None:
    return WorkflowNodesRegistry.get_item(node_id)


def read_node_source(rec: WorkflowNodeRow) -> str:
    return WorkflowNodesRegistry.read_source(rec)


def write_node_source(rec: WorkflowNodeRow, source: str) -> None:
    WorkflowNodesRegistry.write_source(rec, source)


def update_node_record(node_id: str, apply_fn) -> WorkflowNodeRow | None:
    return WorkflowNodesRegistry.update_item(node_id, apply_fn)


def delete_workflow_node(node_id: str) -> WorkflowNodeRow | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    if rec.is_plugin:
        return None
    WorkflowNodePackageManager.delete_node_package(node_id)
    return WorkflowNodesRegistry.delete_item(node_id)


def apply_node_patch(rec: WorkflowNodeRow, patch: WorkflowNodePatch) -> None:
    if rec.is_plugin:
        raise ValueError("cannot patch plugin workflow node")
    data = patch.model_dump(exclude_unset=True)
    if "source" in data and patch.source is not None:
        write_node_source(rec, patch.source)
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(patch.source)
        rec.name = getattr(node_cls, "label", rec.name)
        rec.description = getattr(node_cls, "description", rec.description) or ""
    rec.updated_at = utc_now_iso()
