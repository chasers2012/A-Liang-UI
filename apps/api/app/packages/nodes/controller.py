from __future__ import annotations

from typing import Any

from workflow import workflow_node_type_key
from workflow.node_loader import WorkflowNodeLoader
from workflow.parser import Parser

from app.infra.common.datetime_utils import utc_now_iso
from app.packages.visibility.registry import WorkflowDomainNodesRegistry

from .package_manager import WorkflowNodePackageManager
from .registry import WorkflowNodesRegistry
from .schemas import (
    WorkflowNodeCreate,
    WorkflowNodeDetailPublic,
    WorkflowNodeRow,
    WorkflowNodeSummaryPublic,
)


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
        desc=(rec.description or "").strip().splitlines()[0]
        if (rec.description or "").strip()
        else "",
        is_plugin=rec.is_plugin,
        category=node_cls.category,
    )


def _to_detail(rec: WorkflowNodeRow) -> WorkflowNodeDetailPublic | None:
    summary = _to_summary(rec)
    if summary is None:
        return None
    node_cls = WorkflowNodesRegistry.resolve_node_class(rec)
    return WorkflowNodeDetailPublic(
        **summary.model_dump(),
        description=rec.description,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        inputs=[Parser.serialize_socket(s) for s in node_cls.inputs],
        outputs=[Parser.serialize_socket(s) for s in node_cls.outputs],
        source=WorkflowNodesRegistry.read_source(rec),
    )


def _default_workflow_node_params(node_cls: type) -> dict[str, Any]:
    defaults: dict[str, Any] = {}
    for socket in getattr(node_cls, "inputs", ()):
        payload = Parser.serialize_socket(socket)
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        if "default" in payload:
            defaults[name] = payload["default"]
    return defaults


def build_workflow_node_for_graph(
    node_id: str,
    instance_id: str | None = None,
    pos: list[float] | None = None,
) -> dict[str, Any] | None:
    """
    Build a workflow-ready node payload that can be inserted into workflow.nodes.
    """
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    node_cls = WorkflowNodesRegistry.resolve_node_class(rec)
    if node_cls is None:
        return None

    p = pos or [0.0, 0.0]
    try:
        node_pos = [float(p[0]), float(p[1])]
    except (TypeError, ValueError, IndexError):
        node_pos = [0.0, 0.0]

    node_instance_id = (instance_id or "").strip() or rec.id
    return {
        "id": node_instance_id,
        "type": rec.id,
        "label": rec.name,
        "category": getattr(node_cls, "category", ""),
        "inputs": [Parser.serialize_socket(s, include_description=False) for s in node_cls.inputs],
        "outputs": [
            Parser.serialize_socket(s, include_description=False) for s in node_cls.outputs
        ],
        "pos": node_pos,
        "params": _default_workflow_node_params(node_cls),
    }


def load_node_detail(node_id: str) -> WorkflowNodeDetailPublic | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    return _to_detail(rec)


def load_node_details(node_ids: list[str]) -> list[WorkflowNodeDetailPublic]:
    out: list[WorkflowNodeDetailPublic] = []
    for node_id in node_ids:
        detail = load_node_detail(node_id)
        if detail is not None:
            out.append(detail)
    return out


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


def _apply_node_source(rec: WorkflowNodeRow, source: str) -> None:
    if rec.is_plugin:
        raise ValueError("cannot patch plugin workflow node")
    write_node_source(rec, source)
    node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(source)
    rec.name = getattr(node_cls, "label", rec.name)
    rec.description = getattr(node_cls, "description", rec.description) or ""
    rec.updated_at = utc_now_iso()


def update_node_record(source: str) -> WorkflowNodeRow | None:
    node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(source)
    node_id = workflow_node_type_key(node_cls).strip()
    if not node_id:
        raise ValueError("workflow node id cannot be empty")
    return WorkflowNodesRegistry.update_item(node_id, lambda r: _apply_node_source(r, source))


def delete_workflow_node(node_id: str) -> WorkflowNodeRow | None:
    rec = WorkflowNodesRegistry.get_item(node_id)
    if rec is None:
        return None
    if rec.is_plugin:
        return None
    WorkflowNodePackageManager.delete_node_package(node_id)
    return WorkflowNodesRegistry.delete_item(node_id)
