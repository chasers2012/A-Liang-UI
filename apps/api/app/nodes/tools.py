from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool

from . import controller
from .constants import DEFAULT_NODE_SOURCE
from .schemas import WorkflowNodeCreate


@safe_tool(
    "获取新工作流节点模板",
    description="获取工作流节点源码模板。\n返回 DEFAULT_NODE_SOURCE，建议先填充关键逻辑后再创建。",
)
def get_new_workflow_node_template() -> str:
    return DEFAULT_NODE_SOURCE


@safe_tool(
    "创建工作流节点",
    description="创建并保存工作流节点。\n入参为source：节点源码；创建前先执行 LLM 代码审查，审查通过后返回完整节点详情。",
)
def create_workflow_node_tool(source: str) -> dict[str, Any]:
    review = _review_node_source_with_llm(source)
    rec = controller.create_workflow_node(WorkflowNodeCreate(source=source))
    detail = controller.load_node_detail(rec.id)
    if detail is None:
        raise ValueError(f"节点 {rec.id} 创建后加载失败")
    out = detail.model_dump()
    out["review"] = review
    return out


@safe_tool(
    "获取工作流节点详情",
    description="查询工作流节点详情。\n入参 node_id是节点类型的id,不是节点实例的id；返回包含完整 source 的详情。",
)
def get_workflow_node_detail(node_id: str) -> dict[str, Any]:
    detail = controller.load_node_detail(node_id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@safe_tool(
    "获取工作流节点列表",
    description="查询工作流节点列表。\n返回节点列表用于图编辑器选择与预览。",
)
def get_workflow_node_list() -> list[dict[str, Any]]:
    return [x.model_dump() for x in controller.list_nodes()]


def _extract_json_block(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        parts = stripped.split("```")
        for part in parts:
            candidate = part.strip()
            if candidate.startswith("json"):
                payload = candidate[4:].strip()
                if payload:
                    return payload
    return stripped


def _review_node_source_with_llm(source: str) -> dict[str, Any]:
    # Lazy import to avoid module import cycles with chat agent bootstrap path.
    from app.chat.controller import build_chat_model

    llm = build_chat_model()
    prompt = (
        "请审查下面的 Python 工作流节点源码是否适合上线使用，重点检查：语法正确性、"
        "明显运行时风险、危险操作（系统命令/文件破坏）、以及实现与注释是否一致。"
        "请仅输出 JSON，格式为："
        '{"approved": boolean, "summary": string, "issues": [string], "suggestions": [string]}'
        "。如果没有问题，issues 传空数组。"
    )
    resp = llm.invoke(
        [
            SystemMessage(content="你是严格的代码审查助手，只返回 JSON。"),
            HumanMessage(content=f"{prompt}\n\n源码如下：\n```python\n{source}\n```"),
        ],
        config={
            "metadata": {"silent_stream": True},
        },
    )

    content = resp.content if isinstance(resp.content, str) else str(resp.content)
    raw = _extract_json_block(content)
    try:
        review = json.loads(raw)
    except Exception as exc:
        raise ValueError(f"LLM 审查结果不可解析：{exc}") from exc

    approved = bool(review.get("approved", False))
    issues = review.get("issues") or []
    if not approved:
        issue_text = "；".join(str(x) for x in issues if str(x).strip()) or "未通过 LLM 审查"
        raise ValueError(f"源码审查未通过：{issue_text}")


@safe_tool(
    "更新工作流节点",
    description="更新已有工作流节点。\n入参为节点源码source；更新前先执行 LLM 代码审查，审查通过后返回更新后的详情。",
)
def update_workflow_node(source: str) -> dict[str, Any]:
    _review_node_source_with_llm(source)
    rec = controller.update_node_record(source)
    if rec is None:
        raise ValueError("节点不存在")
    detail = controller.load_node_detail(rec.id)
    if detail is None:
        raise ValueError("节点不存在")
    return detail.model_dump()


@safe_tool("删除工作流节点", description="删除指定工作流节点。\n入参 node_id；返回删除记录。")
def delete_workflow_node_tool(node_id: str) -> dict[str, Any]:
    deleted = controller.delete_workflow_node(node_id)
    if deleted is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return deleted.model_dump()


TOOLS = {
    "node.get_new_workflow_node_template": (
        get_new_workflow_node_template,
        ToolAuthorization.allowed,
    ),
    "node.create_workflow_node": (create_workflow_node_tool, ToolAuthorization.allowed),
    "node.get_workflow_node_detail": (get_workflow_node_detail, ToolAuthorization.allowed),
    "node.get_workflow_node_list": (get_workflow_node_list, ToolAuthorization.allowed),
    "node.update_workflow_node": (update_workflow_node, ToolAuthorization.need_authorize),
    "node.delete_workflow_node": (delete_workflow_node_tool, ToolAuthorization.disabled),
}
