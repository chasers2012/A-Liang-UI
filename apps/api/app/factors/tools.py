from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.factors.controller import (
    create_factor as create_factor_controller,
)
from app.factors.controller import (
    delete_factor_record,
    factor_detail,
    list_factors,
)
from app.factors.controller import (
    update_factor as update_factor_controller,
)
from app.factors.registry import FactorItemsRegistry


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
    "创建因子",
    description=("创建因子并持久化。返回创建后的因子详情。"),
)
def create_factor(source: str | None = None) -> dict[str, Any]:
    # Models sometimes omit `source` when tool-calling; use a safe default template.
    src = (source or "").strip()
    if not src:
        src = NEW_FACTOR_TEMPLATE.replace('name = ""', 'name = "new_factor"')

    rec = create_factor_controller(src)

    return factor_detail(rec).model_dump()


@tool("获取因子详情", description="按 factor_id 查询因子详情；不存在时报错。")
def get_factor_detail(factor_id: str) -> dict[str, Any]:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool("获取因子列表", description="获取因子列表。")
def get_factor_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_factors()]


@tool("更新因子", description="更新因子并返回更新后的详情；不存在时报错。")
def update_factor(factor_id: str, source: str) -> dict[str, Any]:
    rec = update_factor_controller(factor_id, source)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool("删除因子", description="删除因子并返回删除前记录；不存在时报错。")
def delete_factor(factor_id: str) -> dict[str, Any]:
    rec = delete_factor_record(factor_id)
    return rec.model_dump()


FACTOR_CHAT_TOOLS = [
    get_new_factor_template,
    create_factor,
    get_factor_detail,
    get_factor_list,
    update_factor,
    delete_factor,
]
