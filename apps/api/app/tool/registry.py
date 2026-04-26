from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.persistence.sqlite_db import get_session
from app.tool.models import ChatToolRow, ToolAuthorization


class ChatToolRegistry:
    """Extensible registry for chat tools (tool name -> tool-like object)."""

    _instance: ChatToolRegistry | None = None

    def __init__(self) -> None:
        self._tools: dict[str, Any] = {}
        self._tools_cache: dict[str, Any] | None = None

    @classmethod
    def instance(cls) -> ChatToolRegistry:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_tool(
        self,
        tool: Any,
        *,
        name: str | None = None,
        category: str | None = None,
        authorization: ToolAuthorization = ToolAuthorization.need_authorize,
    ) -> None:
        """
        Register a tool-like object (must expose `.invoke(...)`).

        `name` is optional; defaults to `tool.name`.
        """
        tool_name = (name or getattr(tool, "name", "")).strip()
        tool_display_name = (getattr(tool, "name", "") or "").strip() or tool_name
        if not tool_name:
            raise ValueError("tool 必须提供 name")
        if not hasattr(tool, "invoke"):
            raise ValueError(f"tool `{tool_name}` 必须实现 invoke(...)")
        self._tools[tool_name] = tool
        self._tools_cache = None
        category_value = (category or "").strip()
        tool_authorization = authorization

        now = datetime.now(timezone.utc).isoformat()
        with get_session() as session:
            existing = session.get(ChatToolRow, tool_name)
            if existing is not None:
                existing.updated_at = now
                existing.name = tool_display_name
                if category_value:
                    existing.category = category_value
                existing.authorization = tool_authorization
                session.add(existing)
            else:
                session.add(
                    ChatToolRow(
                        id=tool_name,
                        name=tool_display_name,
                        category=category_value,
                        updated_at=now,
                        authorization=tool_authorization,
                    )
                )
            session.commit()

    def register_tools(
        self,
        tools: dict[str, Any],
        *,
        category: str | None = None,
        authorization: ToolAuthorization = ToolAuthorization.need_authorize,
    ) -> None:
        for tool_name, tool in tools.items():
            self.register_tool(
                tool,
                name=tool_name,
                category=category,
                authorization=authorization,
            )

    def get_tools(self) -> dict[str, Any]:
        cached = self._tools_cache
        if cached is not None:
            return dict(cached)
        # Snapshot cache to avoid repeated copy/build on hot path.
        self._tools_cache = dict(self._tools)
        return dict(self._tools_cache)
