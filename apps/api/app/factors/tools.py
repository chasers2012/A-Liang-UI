from __future__ import annotations

import inspect
from typing import Any

from factor import Factor
from langchain_core.tools import tool

from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.factors.controller import (
    create_factor,
    delete_factor,
    factor_detail,
    get_factor_detail_by_id,
    list_factors,
    update_factor,
)


@tool(
    "获取新因子模板",
    description=(
        "获取新因子源码模板。\n先基于模板补全 name/逻辑后再调用创建工具；避免直接提交空模板。"
    ),
)
def get_new_factor_template() -> str:
    return NEW_FACTOR_TEMPLATE


@tool(
    "获取因子基类源码",
    description=("获取因子基类源码。\n用于确认可覆写字段与接口契约，生成新因子时应遵循基类约束。"),
)
def get_factor_base_source() -> str:
    return inspect.getsource(Factor)


@tool(
    "创建因子",
    description=(
        "创建并保存新因子。\n入参 source 为完整源码；模型漏传时会使用默认模板。返回创建后的因子详情。"
    ),
)
def create_factor_tool(source: str | None = None) -> dict[str, Any]:
    # Models sometimes omit `source` when tool-calling; use a safe default template.
    src = (source or "").strip()
    if not src:
        src = NEW_FACTOR_TEMPLATE.replace('name = ""', 'name = "new_factor"')

    rec = create_factor(src)

    return factor_detail(rec).model_dump()


@tool("获取因子详情", description="查询单个因子详情。\n入参 factor_id；不存在需抛出明确错误。")
def get_factor_detail(factor_id: str) -> dict[str, Any]:
    rec = get_factor_detail_by_id(factor_id)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool(
    "获取因子列表", description="查询因子列表。\n返回全部因子摘要列表，用于选择后续编辑或运行目标。"
)
def get_factor_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_factors()]


@tool(
    "编辑因子",
    description=(
        "更新已有因子源码。\n入参 factor_id 与 source；用于修改/编辑需求，更新前应确认目标因子存在。"
    ),
)
def update_factor_tool(factor_id: str, source: str) -> dict[str, Any]:
    rec = update_factor(factor_id, source)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool("删除因子", description="删除指定因子。\n入参 factor_id；返回删除前快照，不存在需报错。")
def delete_factor_tool(factor_id: str) -> dict[str, Any]:
    rec = delete_factor(factor_id)
    return rec.model_dump()


FACTOR_CHAT_TOOLS = [
    get_new_factor_template,
    get_factor_base_source,
    create_factor_tool,
    get_factor_detail,
    get_factor_list,
    update_factor_tool,
    delete_factor_tool,
]
