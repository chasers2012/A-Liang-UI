from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.nodes.constants import DEFAULT_NODE_SOURCE
from app.nodes.controller import (
    create_workflow_node,
    delete_workflow_node,
    list_nodes,
    load_node_detail,
    update_node_record,
)
from app.nodes.schemas import WorkflowNodeCreate, WorkflowNodePatch


@tool(description="获取新节点源码模板。")
def get_new_workflow_node_template() -> str:
    return DEFAULT_NODE_SOURCE


@tool(description="创建并保存一个工作流节点。")
def create_workflow_node_tool(body: dict[str, Any]) -> dict[str, Any]:
    src = (body.get("source") or "").strip()
    if not src:
        src = DEFAULT_NODE_SOURCE.strip()
    rec = create_workflow_node(WorkflowNodeCreate(source=src))
    detail = load_node_detail(rec.id)
    if detail is None:
        raise ValueError(f"节点 {rec.id} 创建后加载失败")
    return detail.model_dump()


@tool(description="获取节点详情（含 source）。")
def get_workflow_node_detail(node_id: str) -> dict[str, Any]:
    detail = load_node_detail(node_id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@tool(description="获取节点列表。")
def get_workflow_node_list() -> list[dict[str, Any]]:
    return [x.model_dump() for x in list_nodes()]


@tool(description="更新节点，返回更新后的详情。")
def update_workflow_node(node_id: str, body: WorkflowNodePatch) -> dict[str, Any]:
    rec = update_node_record(node_id, body)
    if rec is None:
        raise ValueError(f"节点 {node_id} 不存在")
    detail = load_node_detail(rec.id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@tool(description="删除节点。")
def delete_workflow_node_tool(node_id: str) -> dict[str, Any]:
    deleted = delete_workflow_node(node_id)
    if deleted is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return deleted.model_dump()


WORKFLOW_NODE_CHAT_TOOLS = [
    get_new_workflow_node_template,
    create_workflow_node_tool,
    get_workflow_node_detail,
    get_workflow_node_list,
    update_workflow_node,
    delete_workflow_node_tool,
]
