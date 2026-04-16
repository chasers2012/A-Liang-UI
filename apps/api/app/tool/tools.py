from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.tool.controller import ToolController


@tool("list_available_tools")
def list_available_tools() -> list[dict[str, Any]]:
    """查询系统当前可用的工具列表、名称和简要描述。"""
    ctrl = ToolController()
    tools = ctrl.get_tools()
    out: list[dict[str, Any]] = []
    for name in sorted(tools.keys()):
        tool_obj = tools[name]
        description = ""
        raw = getattr(tool_obj, "description", None)
        if isinstance(raw, str) and raw.strip():
            description = raw.strip()
        else:
            description = (getattr(tool_obj, "__doc__", "") or "").strip()
        out.append(
            {
                "id": name,
                "name": name,
                "description": description,
                "loaded": True,
            }
        )
    return out
