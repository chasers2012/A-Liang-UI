from __future__ import annotations

from typing import Any

from deepagents import FilesystemPermission

from app.packages.agents.subagent_catalog import get_subagent_catalog_item
from app.packages.agents.tooling import build_tools, resolve_subagent_tool_ids

CATALOG_ITEM = get_subagent_catalog_item("strategy-manager")
if CATALOG_ITEM is None:
    raise RuntimeError("missing subagent catalog item: strategy-manager")
TOOL_IDS = set(CATALOG_ITEM.default_tool_ids)


def build_subagent() -> dict[str, Any]:

    return {
        "name": "strategy-manager",
        "description": "用于创建策略、查询策略、修改策略。以及通过回测评估策略的效果。"
        "你必须将任何与策略或回测有关的任务委派给此子代理。你必须通过此子代理了解任何与策略或回测有关的细节。"
        "同时该子代理负责策略回测任务的触发与结果查询。",
        "system_prompt": (
            "你是 strategy-manager 子代理，专注策略实现与回测执行，仅返回所要求的信息。"
            "你应该拒绝执行任何你的工具功能所不能覆盖的任务。"
            "你应该在信息不足时要求补充。"
        ),
        "skills": ["/skills/strategy/", "/skills/common/"],
        "permissions": [
            FilesystemPermission(
                operations=["read"],
                paths=["/skills/strategy/**", "/skills/common/**"],
                mode="allow",
            ),
            FilesystemPermission(
                operations=["write", "read"],
                paths=["/**"],
                mode="deny",
            ),
        ],
        **build_tools(resolve_subagent_tool_ids("strategy-manager", TOOL_IDS)),
    }
