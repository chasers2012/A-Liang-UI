from __future__ import annotations

from fastapi import APIRouter, HTTPException
from workflow import workflow_node_type_key
from workflow.node_loader import WorkflowNodeLoader

from app.visibility.api import router as domains_router

from . import controller
from .constants import DEFAULT_NODE_SOURCE
from .schemas import (
    WorkflowNodeCreate,
    WorkflowNodeDetailPublic,
    WorkflowNodePatch,
    WorkflowNodeSummaryPublic,
)

router = APIRouter(prefix="/nodes", tags=["nodes"])
router.include_router(domains_router)


@router.get("", response_model=list[WorkflowNodeSummaryPublic])
def get_nodes(domain: str | None = None) -> list[WorkflowNodeSummaryPublic]:
    return controller.list_nodes(domain=domain)


@router.get("/template", response_model=str)
def get_node_template() -> str:
    return DEFAULT_NODE_SOURCE


@router.post("", response_model=WorkflowNodeDetailPublic)
def create_node(body: WorkflowNodeCreate) -> WorkflowNodeDetailPublic:
    try:
        rec = controller.create_workflow_node(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    detail = controller.load_node_detail(rec.id)
    if detail is None:
        raise HTTPException(status_code=500, detail="节点创建后加载失败")
    return detail


@router.get("/{node_id}", response_model=WorkflowNodeDetailPublic)
def get_node(node_id: str) -> WorkflowNodeDetailPublic:
    detail = controller.load_node_detail(node_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="节点不存在")
    return detail


@router.patch("/{node_id}", response_model=WorkflowNodeDetailPublic)
def patch_node(node_id: str, body: WorkflowNodePatch) -> WorkflowNodeDetailPublic:
    try:
        source = (body.source or "").strip()
        if not source:
            raise ValueError("source 不能为空")
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(source)
        parsed_node_id = workflow_node_type_key(node_cls).strip()
        if parsed_node_id != node_id:
            raise ValueError("路径 node_id 与源码解析出的 node_id 不一致")
        rec = controller.update_node_record(source)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if rec is None:
        raise HTTPException(status_code=404, detail="节点不存在")

    detail = controller.load_node_detail(rec.id)
    if detail is None:
        raise HTTPException(status_code=404, detail="节点不存在")
    return detail


@router.delete("/{node_id}", status_code=204)
def delete_node(node_id: str) -> None:
    if controller.delete_workflow_node(node_id) is None:
        raise HTTPException(status_code=404, detail="节点不存在")
