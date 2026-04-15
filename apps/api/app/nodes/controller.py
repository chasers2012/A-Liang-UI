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


def create_workflow_node(body: WorkflowNodeCreate) -> WorkflowNodeRow:
    node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(body.source)
    nid = workflow_node_type_key(node_cls).strip()
    if not nid:
        raise ValueError("workflow node id cannot be empty")
    if WorkflowNodesRegistry.get_item(nid) is not None:
        raise ValueError(f"Workflow node {nid} already exists")
    now = utc_now_iso()
    rec = body.to_record(nid, now, WorkflowNodePackageManager.get_source_path(nid))
    WorkflowNodePackageManager.write_node_package(nid, body.source)
    WorkflowNodesRegistry.add_item(rec)
    return rec


def _to_summary(rec: WorkflowNodeRow) -> WorkflowNodeSummaryPublic:
    node_cls = WorkflowNodesRegistry.resolve_node_class(rec)
    if node_cls is None:
        return None

    return WorkflowNodeSummaryPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        is_plugin=rec.is_plugin,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        category=node_cls.category,
        inputs=[Parser.serialize_socket(s) for s in node_cls.inputs],
        outputs=[Parser.serialize_socket(s) for s in node_cls.outputs],
    )


def load_node_detail(node_id: str) -> WorkflowNodeDetailPublic | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    summary = _to_summary(rec)
    if summary is None:
        return None
    return WorkflowNodeDetailPublic(
        **summary.model_dump(), source=WorkflowNodesRegistry.read_source(rec)
    )


def list_nodes(domain: str | None = None) -> list[WorkflowNodeSummaryPublic]:
    """
    List nodes, optionally filtered by domain visibility.

    Behavior matches WorkflowDomainNodesRegistry:
    - If the domain is not configured, all nodes are allowed.
    - Otherwise, only configured node ids are blocked (blacklist).
    """
    hidden_ids: set[str] | None = None
    if domain:
        hidden_ids = WorkflowDomainNodesRegistry.get_hidden_node_ids(domain)

    db_recs = WorkflowNodesRegistry.list_items()
    out: list[WorkflowNodeSummaryPublic] = []
    for rec in db_recs:
        if hidden_ids is not None and rec.id in hidden_ids:
            continue
        try:
            summary = _to_summary(rec)
            if summary is not None:
                out.append(summary)
            else:
                print(f"Failed to load node summary for {rec.id}")
                continue
        except Exception as e:
            print(f"Failed to load node summary for {rec.id}")
            print(e)
            continue
    return out


def read_node_source(rec: WorkflowNodeRow) -> str:
    return WorkflowNodesRegistry.read_source(rec)


def write_node_source(rec: WorkflowNodeRow, source: str) -> None:
    WorkflowNodesRegistry.write_source(rec, source)


def _apply_node_patch(rec: WorkflowNodeRow, patch: WorkflowNodePatch) -> None:
    if rec.is_plugin:
        raise ValueError("cannot patch plugin workflow node")
    data = patch.model_dump(exclude_unset=True)
    if "source" in data and patch.source is not None:
        write_node_source(rec, patch.source)
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(patch.source)
        rec.name = getattr(node_cls, "label", rec.name)
        rec.description = getattr(node_cls, "description", rec.description) or ""
    rec.updated_at = utc_now_iso()


def update_node_record(node_id: str, patch: WorkflowNodePatch) -> WorkflowNodeRow | None:
    return WorkflowNodesRegistry.update_item(node_id, lambda r: _apply_node_patch(r, patch))


def delete_workflow_node(node_id: str) -> WorkflowNodeRow | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    if rec.is_plugin:
        return None
    WorkflowNodePackageManager.delete_node_package(node_id)
    return WorkflowNodesRegistry.delete_item(node_id)
