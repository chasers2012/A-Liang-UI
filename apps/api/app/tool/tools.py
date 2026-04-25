from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.tool.controller import ToolController


@tool(
    "列出可用工具",
    description="查询系统当前可用的工具列表、名称和简要描述。该列表会返回系统中所有的工具，并不代表你能调用它们，仅将它作为系统能力的参考。",
)
def list_available_tools() -> list[dict[str, Any]]:
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
