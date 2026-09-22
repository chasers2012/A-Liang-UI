from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlmodel import select

from app.infra.persistence.sqlite_db import get_session
from app.packages.tool.models import ChatToolRow, ToolAuthorization


class ChatToolRegistry:
    """Extensible registry for chat tools (tool name -> tool-like object)."""

    _instance: ChatToolRegistry | None = None

    def __init__(self) -> None:
        self._tools: dict[str, Any] = {}

    @classmethod
    def instance(cls) -> ChatToolRegistry:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_tool(
        self,
        tool: Any,
        *,
        id: str | None = None,
        category: str | None = None,
        authorization: ToolAuthorization = ToolAuthorization.need_authorize,
    ) -> None:
        """
        Register a tool-like object (must expose `.invoke(...)`).

        `name` is optional; defaults to `tool.name`.
        """
        tool_id = (id or getattr(tool, "name", "")).strip()
        tool_display_name = (getattr(tool, "name", "") or "").strip() or tool_id
        if not tool_id:
            raise ValueError("tool 必须提供 id")
        if not hasattr(tool, "invoke"):
            raise ValueError(f"tool `{tool_id}` 必须实现 invoke(...)")
        self._tools[tool_id] = tool
        category_value = (category or "").strip()
        tool_authorization = authorization

        now = datetime.now(timezone.utc).isoformat()
        with get_session() as session:
            existing = session.get(ChatToolRow, tool_id)
            if existing is not None:
                return
            session.add(
                ChatToolRow(
                    id=tool_id,
                    name=tool_display_name,
                    category=category_value,
                    updated_at=now,
                    authorization=tool_authorization,
                )
            )
            session.commit()

    def register_tools(
        self,
        tools: dict[str, tuple[Any, ToolAuthorization]],
        *,
        category: str | None = None,
    ) -> None:
        for tool_id, t in tools.items():
            auth = t[1]
            self.register_tool(
                t[0],
                id=tool_id,
                category=category,
                authorization=auth,
            )

    def get_tools(self) -> dict[str, Any]:
        tool_ids = list(self._tools.keys())
        if not tool_ids:
            return {}

        with get_session() as session:
            rows = list(session.exec(select(ChatToolRow).where(ChatToolRow.id.in_(tool_ids))))

        # Intersect DB records with in-memory tool functions and keep latest auth from DB.
        allowed_ids = {row.id for row in rows if row.authorization != ToolAuthorization.disabled}
        return {tool_id: tool for tool_id, tool in self._tools.items() if tool_id in allowed_ids}
