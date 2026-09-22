from __future__ import annotations

from typing import Any

from app.packages.agents.subagent_catalog import get_subagent_catalog_item
from app.packages.agents.tooling import build_tools, resolve_subagent_tool_ids

CATALOG_ITEM = get_subagent_catalog_item("data_resource_manager")
if CATALOG_ITEM is None:
    raise RuntimeError("missing subagent catalog item: data_resource_manager")
TOOL_IDS = set(CATALOG_ITEM.default_tool_ids)


def build_subagent() -> dict[str, Any] | None:

    return {
        "name": "data_resource_manager",
        "description": "用于维护数据源与数据集资产。"
        "只要数据集中包含了所需要的依赖字段，数据集就可以在任何需要使用数据源的地方复用。一个数据集可以聚合多个数据源。"
        "当任务是创建/更新/查询数据源或数据集、测试数据源连接时应委派给该子代理。",
        "system_prompt": (
            "你是 data_resource_manager 子代理，专注数据源与数据集维护。除非现有的数据集缺少所需的列或无法覆盖所要求的时间范围，否则返回建议使用现有数据集"
        ),
        "skills": ["/skills/"],
        **build_tools(resolve_subagent_tool_ids("data_resource_manager", TOOL_IDS)),
    }
