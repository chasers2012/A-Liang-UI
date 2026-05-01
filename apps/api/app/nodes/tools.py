from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool

from . import controller
from .constants import DEFAULT_NODE_SOURCE
from .schemas import WorkflowNodeCreate


@safe_tool("获取新工作流节点模板", parse_docstring=True)
def get_new_workflow_node_template() -> str:
    """
    获取工作流节点源码模板。

    返回 `DEFAULT_NODE_SOURCE`；建议先填充关键逻辑后再创建节点。

    Returns:
        节点源码模板字符串。
    """
    return DEFAULT_NODE_SOURCE


@safe_tool("创建工作流节点", parse_docstring=True)
def create_workflow_node_tool(source: str) -> dict[str, Any]:
    """
    创建并保存工作流节点。

    创建前会执行 LLM 代码审查，审查通过后返回包含完整 `source` 的节点详情。

    Args:
        source: 节点源码（完整 Python 源码）。

    Returns:
        创建后的节点详情（包含 `review` 字段）。
    """
    review = _review_node_source_with_llm(source)
    rec = controller.create_workflow_node(WorkflowNodeCreate(source=source))
    detail = controller.load_node_detail(rec.id)
    if detail is None:
        raise ValueError(f"节点 {rec.id} 创建后加载失败")
    out = detail.model_dump()
    out["review"] = review
    return out


@safe_tool("获取工作流节点详情", parse_docstring=True)
def get_workflow_node_detail(node_id: str) -> dict[str, Any]:
    """
    查询工作流节点详情。

    注意：`node_id` 是“节点类型 ID”，不是节点实例 ID；返回包含完整 `source` 的详情。

    Args:
        node_id: 节点类型 ID。

    Returns:
        节点详情字典。
    """
    detail = controller.load_node_detail(node_id)
    if detail is None:
        raise ValueError(f"节点 {node_id} 不存在")
    return detail.model_dump()


@safe_tool("批量获取工作流节点详情", parse_docstring=True)
def get_workflow_node_details(node_ids: list[str]) -> list[dict[str, Any]]:
    """
    批量查询工作流节点详情。

    Args:
        node_ids: 节点类型 ID 列表。

    Returns:
        存在节点的完整详情列表。
    """
    return [x.model_dump() for x in controller.load_node_details(node_ids)]


@safe_tool("获取工作流节点列表", parse_docstring=True)
def get_workflow_node_list() -> list[dict[str, Any]]:
    """
    查询工作流节点列表。

    Returns:
        节点列表，用于图编辑器选择与预览。
    """
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


@safe_tool("更新工作流节点", parse_docstring=True)
def update_workflow_node(source: str) -> dict[str, Any]:
    """
    更新已有工作流节点。

    更新前会执行 LLM 代码审查，审查通过后返回更新后的节点详情。

    Args:
        source: 节点源码（完整 Python 源码）。

    Returns:
        更新后的节点详情。
    """
    _review_node_source_with_llm(source)
    rec = controller.update_node_record(source)
    if rec is None:
        raise ValueError("节点不存在")
    detail = controller.load_node_detail(rec.id)
    if detail is None:
        raise ValueError("节点不存在")
    return detail.model_dump()


@safe_tool("删除工作流节点", parse_docstring=True)
def delete_workflow_node_tool(node_id: str) -> dict[str, Any]:
    """
    删除指定工作流节点。

    Args:
        node_id: 节点类型 ID。

    Returns:
        删除记录。
    """
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
    "node.get_workflow_node_details": (get_workflow_node_details, ToolAuthorization.allowed),
    "node.get_workflow_node_list": (get_workflow_node_list, ToolAuthorization.allowed),
    "node.update_workflow_node": (update_workflow_node, ToolAuthorization.need_authorize),
    "node.delete_workflow_node": (delete_workflow_node_tool, ToolAuthorization.disabled),
}
