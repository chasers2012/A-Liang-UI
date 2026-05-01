from __future__ import annotations

import inspect
from typing import Any

from factor import Factor

from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool

from . import controller


@safe_tool("get_new_factor_template", parse_docstring=True)
def get_new_factor_template() -> str:
    """
    获取新因子源码模板。

    当需要了解因子代码格式时使用该工具。

    Returns:
        因子源码模板字符串。
    """
    return NEW_FACTOR_TEMPLATE


@safe_tool("get_factor_base_source", parse_docstring=True)
def get_factor_base_source() -> str:
    """
    获取因子基类源码。

    Returns:
        因子基类 `Factor` 的源码文本。
    """
    return inspect.getsource(Factor)


@safe_tool("create_factor_tool", parse_docstring=True)
def create_factor_tool(source: str | None = None) -> dict[str, Any]:
    """
    创建并保存新因子。

    Args:
        source: 因子完整源码。

    Returns:
        创建后的因子详情。
    """
    src = (source or "").strip()
    if not src:
        raise ValueError("需要传入因子源码")
    rec = controller.create_factor(src)
    return controller.factor_detail(rec).model_dump()


@safe_tool("get_factor_detail", parse_docstring=True)
def get_factor_detail(factor_id: str) -> dict[str, Any]:
    """
    查询单个因子详情。

    Args:
        factor_id: 因子 ID；不存在会抛出明确错误。

    Returns:
        因子详情。
    """
    rec = controller.get_factor_detail_by_id(factor_id)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return controller.factor_detail(rec).model_dump()


@safe_tool("get_factor_list", parse_docstring=True)
def get_factor_list() -> list[dict[str, Any]]:
    """
    查询因子列表。

    Returns:
        全部因子摘要列表，用于选择后续编辑或运行目标。
    """
    return [f.model_dump() for f in controller.list_factors()]


@safe_tool("update_factor_tool", parse_docstring=True)
def update_factor_tool(factor_id: str, source: str) -> dict[str, Any]:
    """
    更新已有因子源码。

    Args:
        factor_id: 因子 ID。
        source: 新的因子源码。

    Returns:
        更新后的因子详情。
    """
    rec = controller.update_factor(factor_id, source)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return controller.factor_detail(rec).model_dump()


@safe_tool("delete_factor_tool", parse_docstring=True)
def delete_factor_tool(factor_id: str) -> dict[str, Any]:
    """
    删除指定因子。

    Args:
        factor_id: 因子 ID；不存在需报错。

    Returns:
        删除前快照。
    """
    rec = controller.delete_factor(factor_id)
    return rec.model_dump()


TOOLS = {
    "factor.get_new_factor_template": (get_new_factor_template, ToolAuthorization.allowed),
    "factor.create_factor": (create_factor_tool, ToolAuthorization.allowed),
    "factor.get_factor_detail": (get_factor_detail, ToolAuthorization.allowed),
    "factor.get_factor_list": (get_factor_list, ToolAuthorization.allowed),
    "factor.update_factor": (update_factor_tool, ToolAuthorization.need_authorize),
    "factor.delete_factor": (delete_factor_tool, ToolAuthorization.disabled),
}
