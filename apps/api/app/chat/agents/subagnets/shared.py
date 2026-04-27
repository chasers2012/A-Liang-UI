from __future__ import annotations

from typing import Any


def build_subagent_tools(
    all_tools_by_id: dict[str, Any],
    *,
    candidate_tool_ids: set[str],
) -> list[Any]:
    picked: list[Any] = []
    for tool_id in candidate_tool_ids:
        tool = all_tools_by_id.get(tool_id)
        if tool is None:
            continue
        runtime_tool_name = (getattr(tool, "name", "") or "").strip()
        if not runtime_tool_name:
            continue
        picked.append(tool)
    return picked


def build_subagent_interrupt_on(
    tools: list[Any],
    *,
    need_authorize_tool_ids: set[str],
    all_tools_by_id: dict[str, Any],
) -> dict[str, bool] | None:
    runtime_names: set[str] = set()
    for tool_id in need_authorize_tool_ids:
        tool = all_tools_by_id.get(tool_id)
        if tool is None:
            continue
        runtime_name = (getattr(tool, "name", "") or "").strip()
        if runtime_name:
            runtime_names.add(runtime_name)

    interrupt_on: dict[str, bool] = {}
    for tool in tools:
        runtime_name = (getattr(tool, "name", "") or "").strip()
        if runtime_name in runtime_names:
            interrupt_on[runtime_name] = True
    return interrupt_on or None


def format_tool_boundary_section(
    all_tools_by_id: dict[str, Any],
    *,
    tool_ids: set[str],
) -> str:
    lines: list[str] = []
    for tool_id in sorted(tool_ids):
        tool = all_tools_by_id.get(tool_id)
        if tool is None:
            continue
        tool_desc = (getattr(tool, "description", "") or "").strip()
        tool_name = (getattr(tool, "name", "") or "").strip()
        if tool_desc:
            lines.append(f"- {tool_desc}")
        else:
            lines.append(f"- {tool_name}")
    return "\n".join(lines) if lines else "- 无可用工具"


def append_tool_boundary_to_description(
    base_description: str,
    all_tools_by_id: dict[str, Any],
    *,
    tool_ids: set[str],
) -> str:
    return (
        f"{base_description}\n"
        "这个子代理可以调用这些工具：\n"
        f"{format_tool_boundary_section(all_tools_by_id, tool_ids=tool_ids)}"
    )
