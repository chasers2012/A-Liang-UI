from __future__ import annotations

from app.nodes.controller import list_nodes
from fastapi import APIRouter
from workflow.node_loader import WorkflowNodeLoader

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("/node-types")
def list_workflow_node_types() -> list[dict]:
    rows = list_nodes()
    loader = WorkflowNodeLoader.instance()
    for row in rows:
        # Ensure user-defined nodes are resolvable in workflow runtime by node id.
        detail = row
        # Runtime resolver accepts module type key by default; also register id alias.
        # The id alias is what existing evaluation profile workflow used.
        try:
            from app.nodes.registry import WorkflowNodesRegistry
            from workflow.node_loader import WorkflowNodeLoader as _Loader

            rec = WorkflowNodesRegistry.get_item(row.id)
            if rec is not None:
                source = WorkflowNodesRegistry.read_source(rec)
                node_cls = _Loader.load_workflow_node_class_from_source(source)
                loader.register_node(row.id, node_cls)
        except Exception:
            continue
        _ = detail
    return [r.model_dump() for r in rows]
