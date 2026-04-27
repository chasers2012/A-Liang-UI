from __future__ import annotations

from typing import Any

from app.chat.agents.subagnets.shared import (
    append_tool_boundary_to_description,
    build_subagent_interrupt_on,
    build_subagent_tools,
)

TOOL_IDS = {
    "knowledge.search",
}


def build_subagent(
    all_tools_by_id: dict[str, Any],
    *,
    need_authorize_tool_ids: set[str],
) -> dict[str, Any] | None:
    tools = build_subagent_tools(all_tools_by_id, candidate_tool_ids=TOOL_IDS)
    if not tools:
        return None

    return {
        "name": "research",
        "description": append_tool_boundary_to_description(
            (
                "用于研究问题、检索证据、比较方案并产出结论。"
                "当任务需要事实查证、方法论分析、假设验证或逻辑推理时，都应当委派给该子代理。"
            ),
            all_tools_by_id,
            tool_ids=TOOL_IDS,
        ),
        "system_prompt": (
            "你是 research 子代理，负责研究与推理。你需要检索与要求相关的信息，并整理成一份简短的报告。"
        ),
        "tools": tools,
        "interrupt_on": build_subagent_interrupt_on(
            tools,
            need_authorize_tool_ids=need_authorize_tool_ids,
            all_tools_by_id=all_tools_by_id,
        ),
    }
