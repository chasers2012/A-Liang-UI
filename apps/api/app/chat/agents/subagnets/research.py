from __future__ import annotations

from typing import Any

from .shared import (
    build_tools,
)

TOOL_IDS = {
    "knowledge.search",
}


def build_subagent() -> dict[str, Any] | None:

    return {
        "name": "research",
        "description": "用于研究问题、检索证据、比较方案并产出结论。"
        "当任务需要事实查证、方法论分析、假设验证或逻辑推理时，都应当委派给该子代理。",
        "system_prompt": (
            "你是 research 子代理，负责研究与推理。你需要检索与要求相关的信息，并整理成一份简短的报告。"
        ),
        **build_tools(TOOL_IDS),
    }
