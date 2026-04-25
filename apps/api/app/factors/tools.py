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
        "获取内置因子源码模板（NEW_FACTOR_TEMPLATE）。"
        "通常先取模板并填充源码，再调用“创建因子”工具保存因子。"
    ),
)
def get_new_factor_template() -> str:
    return NEW_FACTOR_TEMPLATE


@tool(
    "获取因子基类源码",
    description=(
        "获取因子基类（Factor）完整源码。通常在编写新因子前先参考该源码中的接口约定和可覆写字段。"
    ),
)
def get_factor_base_source() -> str:
    return inspect.getsource(Factor)


@tool(
    "创建因子",
    description=("创建因子并持久化。返回创建后的因子详情。"),
)
def create_factor_tool(source: str | None = None) -> dict[str, Any]:
    # Models sometimes omit `source` when tool-calling; use a safe default template.
    src = (source or "").strip()
    if not src:
        src = NEW_FACTOR_TEMPLATE.replace('name = ""', 'name = "new_factor"')

    rec = create_factor(src)

    return factor_detail(rec).model_dump()


@tool("获取因子详情", description="按 factor_id 查询因子详情；不存在时报错。")
def get_factor_detail(factor_id: str) -> dict[str, Any]:
    rec = get_factor_detail_by_id(factor_id)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool("获取因子列表", description="获取因子列表。")
def get_factor_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_factors()]


@tool("更新因子", description="更新因子并返回更新后的详情；不存在时报错。")
def update_factor_tool(factor_id: str, source: str) -> dict[str, Any]:
    rec = update_factor(factor_id, source)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool("删除因子", description="删除因子并返回删除前记录；不存在时报错。")
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
