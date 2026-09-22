from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.infra.llm_tools.review_with_llm import review_with_llm
from app.infra.tooling.safe_tool import safe_tool
from app.packages.tool.models import ToolAuthorization

from . import controller
from .constants import DEFAULT_NODE_SOURCE
from .schemas import WorkflowNodeCreate


@safe_tool("get_new_workflow_node_template", parse_docstring=True)
def get_new_workflow_node_template() -> str:
    """
    获取工作流节点源码模板。

    返回 `DEFAULT_NODE_SOURCE`；建议先填充关键逻辑后再创建节点。

    Returns:
        节点源码模板字符串。
    """
    return DEFAULT_NODE_SOURCE


@safe_tool("create_workflow_node_tool", parse_docstring=True)
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


@safe_tool("get_workflow_node_detail", parse_docstring=True)
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


@safe_tool("get_workflow_node_details", parse_docstring=True)
def get_workflow_node_details(node_ids: list[str]) -> list[dict[str, Any]]:
    """
    批量查询工作流节点详情。

    Args:
        node_ids: 节点类型 ID 列表。

    Returns:
        存在节点的完整详情列表。
    """
    return [x.model_dump() for x in controller.load_node_details(node_ids)]


@safe_tool("get_workflow_node_list", parse_docstring=True)
def get_workflow_node_list() -> list[dict[str, Any]]:
    """
    查询工作流节点列表。

    Returns:
        节点列表，用于图编辑器选择与预览。
    """
    return [x.model_dump() for x in controller.list_nodes()]


class _NodeSourceReview(BaseModel):
    approved: bool
    summary: str = ""
    issues: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


def _review_node_source_with_llm(source: str) -> dict[str, Any]:
    prompt = (
        "请审查下面的 Python 工作流节点源码是否适合上线使用，重点检查：语法正确性、"
        "明显运行时风险、危险操作（系统命令/文件破坏）、以及实现与注释是否一致。"
    )
    return review_with_llm(
        system_prompt="你是严格的代码审查助手。",
        review_prompt=prompt,
        review_input=source,
        output_model=_NodeSourceReview,
        input_format="python",
        input_title="源码如下：",
        reject_message_prefix="源码审查未通过",
    )


@safe_tool("update_workflow_node", parse_docstring=True)
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


@safe_tool("delete_workflow_node_tool", parse_docstring=True)
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
