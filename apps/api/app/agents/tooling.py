from __future__ import annotations

from typing import Any

import app.tool.controller as tool_controller


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


def build_tools(candidate_tool_ids: list[str]) -> dict[str, Any]:
    tools_by_id = tool_controller.get_tools()
    _, need_authorize = tool_controller.split_tool_ids_by_authorization(tools_by_id.keys())

    tools: list[Any] = []
    for tool_id in candidate_tool_ids:
        tool = tools_by_id.get(tool_id)
        if tool is None:
            continue
        runtime_tool_name = (getattr(tool, "name", "") or "").strip()
        if not runtime_tool_name:
            continue
        tools.append(tool)

    return {
        "tools": tools,
        "interrupt_on": build_subagent_interrupt_on(
            tools,
            need_authorize_tool_ids=need_authorize,
            all_tools_by_id=tools_by_id,
        ),
    }


def resolve_subagent_tool_ids(subagent_id: str, default_tool_ids: set[str]) -> list[str]:
    import app.agents.controller as agents_controller

    return agents_controller.get_subagent_tool_ids(subagent_id, list(default_tool_ids))
