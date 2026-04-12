from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.nodes.constants import DEFAULT_NODE_SOURCE
from app.nodes.controller import (
    apply_node_patch,
    create_workflow_node,
    delete_workflow_node,
    get_node_record,
    list_nodes,
    load_node_detail,
    update_node_record,
)
from app.nodes.schemas import (
    WorkflowNodeCreate,
    WorkflowNodeDetailPublic,
    WorkflowNodePatch,
    WorkflowNodeSummaryPublic,
)

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("", response_model=list[WorkflowNodeSummaryPublic])
def get_nodes() -> list[WorkflowNodeSummaryPublic]:
    return list_nodes()


@router.get("/template", response_model=str)
def get_node_template() -> str:
    return DEFAULT_NODE_SOURCE


@router.post("", response_model=WorkflowNodeDetailPublic)
def create_node(body: WorkflowNodeCreate) -> WorkflowNodeDetailPublic:
    try:
        rec = create_workflow_node(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    detail = load_node_detail(rec.id)
    if detail is None:
        raise HTTPException(status_code=500, detail="节点创建后加载失败")
    return detail


@router.get("/{node_id}", response_model=WorkflowNodeDetailPublic)
def get_node(node_id: str) -> WorkflowNodeDetailPublic:
    detail = load_node_detail(node_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="节点不存在")
    return detail


@router.patch("/{node_id}", response_model=WorkflowNodeDetailPublic)
def patch_node(node_id: str, body: WorkflowNodePatch) -> WorkflowNodeDetailPublic:
    try:
        rec = update_node_record(node_id, lambda r: apply_node_patch(r, body))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if rec is None:
        raise HTTPException(status_code=404, detail="节点不存在")

    detail = load_node_detail(rec.id)
    if detail is None:
        raise HTTPException(status_code=404, detail="节点不存在")
    return detail


@router.delete("/{node_id}", status_code=204)
def delete_node(node_id: str) -> None:
    if get_node_record(node_id) is None:
        raise HTTPException(status_code=404, detail="节点不存在")
    if delete_workflow_node(node_id) is None:
        raise HTTPException(status_code=404, detail="节点不存在")
