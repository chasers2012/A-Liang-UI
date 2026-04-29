from __future__ import annotations

from typing import Any

from . import controller
from .safe_tool import safe_tool


@safe_tool(
    "列出可用工具",
    description=(
        "查询系统当前可用工具列表。\n"
        "返回系统内全部工具作为能力参考，不代表当前会话一定允许调用；请结合授权状态判断。工具实际装载在子代理中，通过它们进行操作"
    ),
)
def list_available_tools() -> list[dict[str, Any]]:
    tools = controller.get_tools()
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
