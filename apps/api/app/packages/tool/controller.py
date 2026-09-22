"""Tool controller: expose tool registry management and invocation methods."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlmodel import select

from app.infra.persistence.sqlite_db import get_session
from app.packages.tool.models import ChatToolRow, ToolAuthorization
from app.packages.tool.registry import ChatToolRegistry


def register_tool(
    tool: Any,
    *,
    id: str | None = None,
    category: str | None = None,
    authorization: ToolAuthorization = ToolAuthorization.need_authorize,
) -> None:
    ChatToolRegistry.instance().register_tool(
        tool,
        id=id,
        category=category,
        authorization=authorization,
    )


def register_tools(
    tools: dict[str, tuple[Any, ToolAuthorization]],
    *,
    category: str | None = None,
) -> None:
    ChatToolRegistry.instance().register_tools(
        tools,
        category=category,
    )


def get_tools() -> dict[str, Any]:
    return ChatToolRegistry.instance().get_tools()


def list_tool_names() -> list[str]:
    return sorted(get_tools().keys())


def has_tool(name: str) -> bool:
    tool_name = (name or "").strip()
    if not tool_name:
        return False
    return tool_name in get_tools()


def invoke_tool(name: str, args: Any) -> Any:
    tool_name = (name or "").strip()
    if not tool_name:
        raise ValueError("tool name 不能为空")

    with get_session() as session:
        rec = session.get(ChatToolRow, tool_name)
        if rec is not None and rec.authorization == ToolAuthorization.disabled:
            raise ValueError(f"工具已被禁用：{tool_name}")

    tool = get_tools().get(tool_name)
    if tool is None:
        raise ValueError(f"不允许调用工具：{tool_name}")
    return tool.invoke(args)


def split_tool_ids_by_authorization(tool_ids: Iterable[str]) -> tuple[set[str], set[str]]:
    """
    Returns:
        - disabled ids
        - need_authorize ids
    """
    ids = [i for i in tool_ids if i]
    if not ids:
        return set(), set()

    disabled: set[str] = set()
    need_authorize: set[str] = set()
    with get_session() as session:
        rows = list(session.exec(select(ChatToolRow).where(ChatToolRow.id.in_(ids))))
        for row in rows:
            if row.authorization == ToolAuthorization.disabled:
                disabled.add(row.id)
            elif row.authorization == ToolAuthorization.need_authorize:
                need_authorize.add(row.id)
    return disabled, need_authorize
