from __future__ import annotations

from typing import Any

from app.agents.subagent_catalog import get_subagent_catalog_item
from app.agents.tooling import build_tools, resolve_subagent_tool_ids

CATALOG_ITEM = get_subagent_catalog_item("research")
if CATALOG_ITEM is None:
    raise RuntimeError("missing subagent catalog item: research")
TOOL_IDS = set(CATALOG_ITEM.default_tool_ids)


def build_subagent() -> dict[str, Any] | None:

    return {
        "name": "research",
        "description": "用于研究问题、检索证据、比较方案并产出结论。"
        "当任务需要事实查证、方法论分析、假设验证或逻辑推理时，都应当委派给该子代理。",
        "system_prompt": (
            "你是 research 子代理，负责研究与推理。你需要检索与要求相关的信息，并整理成一份简短的报告。"
        ),
        "skills": ["/skills/"],
        **build_tools(resolve_subagent_tool_ids("research", TOOL_IDS)),
    }
