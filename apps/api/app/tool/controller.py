"""Tool controller: expose tool registry management and invocation methods."""

from __future__ import annotations

from typing import Any

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
