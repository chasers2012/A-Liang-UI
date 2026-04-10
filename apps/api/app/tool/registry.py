from __future__ import annotations

from typing import Any


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

    def register_tool(self, tool: Any, *, name: str | None = None) -> None:
        """
        Register a tool-like object (must expose `.invoke(...)`).

        `name` is optional; defaults to `tool.name`.
        """
        tool_name = (name or getattr(tool, "name", "")).strip()
        if not tool_name:
            raise ValueError("tool 必须提供 name")
        if not hasattr(tool, "invoke"):
            raise ValueError(f"tool `{tool_name}` 必须实现 invoke(...)")
        self._tools[tool_name] = tool
        self._tools_cache = None

    def register_tools(self, tools: dict[str, Any]) -> None:
        for tool_name, tool in tools.items():
            self.register_tool(tool, name=tool_name)

    def get_tools(self) -> dict[str, Any]:
        cached = self._tools_cache
        if cached is not None:
            return dict(cached)
        # Snapshot cache to avoid repeated copy/build on hot path.
        self._tools_cache = dict(self._tools)
        return dict(self._tools_cache)
