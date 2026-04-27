from __future__ import annotations

from typing import Any

from app.chat.agents.subagnets.shared import (
    append_tool_boundary_to_description,
    build_subagent_interrupt_on,
    build_subagent_tools,
)

TOOL_IDS = {
    "datasource.create_datasource",
    "datasource.get_datasource_detail",
    "datasource.get_datasource_list",
    "datasource.update_datasource",
    "datasource.test_datasource_connection",
    "data_set.create_data_set",
    "data_set.get_data_set_detail",
    "data_set.get_data_set_list",
    "data_set.update_data_set",
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
        "name": "data_resource_manager",
        "description": append_tool_boundary_to_description(
            (
                "用于维护数据源与数据集资产。只要数据集中包含了所需要的依赖字段，数据集就可以在任何需要使用数据源的地方复用。一个数据集可以聚合多个数据源。"
                "当任务是创建/更新/查询数据源或数据集、测试数据源连接时应委派给该子代理。"
            ),
            all_tools_by_id,
            tool_ids=TOOL_IDS,
        ),
        "system_prompt": ("你是 data_resource_manager 子代理，专注数据源与数据集维护。"),
        "tools": tools,
        "interrupt_on": build_subagent_interrupt_on(
            tools,
            need_authorize_tool_ids=need_authorize_tool_ids,
            all_tools_by_id=all_tools_by_id,
        ),
    }
