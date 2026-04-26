"""Tool controller: expose tool registry management and invocation methods."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlmodel import select

from app.persistence.sqlite_db import get_session
from app.tool.models import ChatToolRow, ToolAuthorization
from app.tool.registry import ChatToolRegistry


class ToolController:
    """Thin controller around ChatToolRegistry for tool management."""

    def __init__(self, *, tool_registry: ChatToolRegistry | None = None) -> None:
        self._registry = tool_registry or ChatToolRegistry.instance()

    def register_tool(
        self,
        tool: Any,
        *,
        name: str | None = None,
        category: str | None = None,
        authorization: ToolAuthorization = ToolAuthorization.need_authorize,
    ) -> None:
        self._registry.register_tool(
            tool,
            name=name,
            category=category,
            authorization=authorization,
        )

    def register_tools(
        self,
        tools: dict[str, Any],
        *,
        category: str | None = None,
        authorization: ToolAuthorization = ToolAuthorization.need_authorize,
    ) -> None:
        self._registry.register_tools(
            tools,
            category=category,
            authorization=authorization,
        )

    def get_tools(self) -> dict[str, Any]:
        return self._registry.get_tools()

    def list_tool_names(self) -> list[str]:
        return sorted(self.get_tools().keys())

    def has_tool(self, name: str) -> bool:
        tool_name = (name or "").strip()
        if not tool_name:
            return False
        return tool_name in self.get_tools()

    def invoke_tool(self, name: str, args: Any) -> Any:
        tool_name = (name or "").strip()
        if not tool_name:
            raise ValueError("tool name 不能为空")

        with get_session() as session:
            rec = session.get(ChatToolRow, tool_name)
            if rec is not None and rec.authorization == ToolAuthorization.disabled:
                raise ValueError(f"工具已被禁用：{tool_name}")

        tool = self.get_tools().get(tool_name)
        if tool is None:
            raise ValueError(f"不允许调用工具：{tool_name}")
        return tool.invoke(args)

    def split_tool_ids_by_authorization(self, tool_ids: Iterable[str]) -> tuple[set[str], set[str]]:
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
