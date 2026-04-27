from __future__ import annotations

from typing import Any

from app.nodes.constants import DEFAULT_NODE_SOURCE
from app.nodes.controller import (
    build_workflow_node_for_graph,
    create_workflow_node,
    delete_workflow_node,
    list_nodes,
    load_node_detail,
    update_node_record,
)
from app.nodes.schemas import WorkflowNodeCreate, WorkflowNodePatch
from app.tool.safe_tool import safe_tool


@safe_tool(
    "获取新工作流节点模板",
    description="获取工作流节点源码模板。\n返回 DEFAULT_NODE_SOURCE，建议先填充关键逻辑后再创建。",
)
def get_new_workflow_node_template() -> str:
    return DEFAULT_NODE_SOURCE


@safe_tool(
    "创建工作流节点",
    description="创建并保存工作流节点。\n入参 body 可传 source；未传时使用默认模板。创建后返回完整节点详情。",
)
def create_workflow_node_tool(body: dict[str, Any]) -> dict[str, Any]:
    src = (body.get("source") or "").strip()
    if not src:
        src = DEFAULT_NODE_SOURCE.strip()
    rec = create_workflow_node(WorkflowNodeCreate(source=src))
    detail = load_node_detail(rec.id)
    if detail is None:
        raise ValueError(f"节点 {rec.id} 创建后加载失败")
    return detail.model_dump()


@safe_tool(
    "获取工作流节点详情",
    description="查询工作流节点详情。\n入参 node_id是节点类型的id,不是节点实例的id；返回包含完整 source 的详情。",
)
def get_workflow_node_detail(node_id: str) -> dict[str, Any]:
    detail = load_node_detail(node_id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@safe_tool(
    "获取工作流节点列表",
    description="查询工作流节点列表。\n返回节点列表用于图编辑器选择与预览。",
)
def get_workflow_node_list() -> list[dict[str, Any]]:
    return [x.model_dump() for x in list_nodes()]


@safe_tool(
    "获取格式化工作流节点",
    description="获取格式化工作流节点。\n入参 node_id，可选 instance_id/pos_x/pos_y；返回可直接写入 workflow.nodes 的结构。",
)
def get_formatted_workflow_node(
    node_id: str,
    instance_id: str = "",
    pos_x: float = 0.0,
    pos_y: float = 0.0,
) -> dict[str, Any]:
    node = build_workflow_node_for_graph(
        node_id=node_id,
        instance_id=instance_id or None,
        pos=[pos_x, pos_y],
    )
    if node is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return node


@safe_tool(
    "更新工作流节点",
    description="更新已有工作流节点。\n入参 node_id 与 WorkflowNodePatch；返回更新后的详情。",
)
def update_workflow_node(node_id: str, body: WorkflowNodePatch) -> dict[str, Any]:
    rec = update_node_record(node_id, body)
    if rec is None:
        raise ValueError(f"节点 {node_id} 不存在")
    detail = load_node_detail(rec.id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@safe_tool("删除工作流节点", description="删除指定工作流节点。\n入参 node_id；返回删除记录。")
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
    get_formatted_workflow_node,
    update_workflow_node,
    delete_workflow_node_tool,
]
