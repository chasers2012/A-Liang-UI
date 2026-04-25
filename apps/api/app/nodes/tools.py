from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

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


@tool("获取新工作流节点模板", description="获取工作流节点源码模板（DEFAULT_NODE_SOURCE）。")
def get_new_workflow_node_template() -> str:
    return DEFAULT_NODE_SOURCE


@tool(
    "创建工作流节点",
    description="创建工作流节点并返回详情；入参 body 可提供 source，缺省使用内置模板。",
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


@tool("获取工作流节点详情", description="按 node_id 查询节点详情（含完整 source）；不存在时报错。")
def get_workflow_node_detail(node_id: str) -> dict[str, Any]:
    detail = load_node_detail(node_id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@tool("获取工作流节点列表", description="获取工作流节点列表。")
def get_workflow_node_list() -> list[dict[str, Any]]:
    return [x.model_dump() for x in list_nodes()]


@tool("获取格式化工作流节点", description="按 node_id 获取可直接放入 workflow.nodes 的格式化节点。")
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


@tool("更新工作流节点", description="更新节点并返回更新后的详情；不存在时报错。")
def update_workflow_node(node_id: str, body: WorkflowNodePatch) -> dict[str, Any]:
    rec = update_node_record(node_id, body)
    if rec is None:
        raise ValueError(f"节点 {node_id} 不存在")
    detail = load_node_detail(rec.id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@tool("删除工作流节点", description="删除节点并返回删除记录；不存在时报错。")
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
