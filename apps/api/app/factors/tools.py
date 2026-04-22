from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.factors.controller import (
    create_factor as create_factor_controller,
)
from app.factors.controller import (
    factor_detail,
    list_factors,
)
from app.factors.controller import (
    update_factor as update_factor_controller,
)
from app.factors.registry import FactorItemsRegistry
from app.factors.schemas import FactorCreate, FactorPatch


@tool(
    description=(
        "获取内置因子源码模板（NEW_FACTOR_TEMPLATE）。"
        "通常先取模板并填充源码，再调用 create_factor 保存因子。"
    )
)
def get_new_factor_template() -> str:
    return NEW_FACTOR_TEMPLATE


@tool(
    description=(
        "创建因子并持久化。"
        "入参 body 需包含 name（合法 Python 标识符）和 source（完整 Python 源码）；"
        "若 source 为空会自动基于模板补全。返回创建后的因子详情。"
    )
)
def create_factor(body: FactorCreate) -> dict[str, Any]:
    """
    body: FactorCreate = {
        "name": "因子名称",
        "group": "因子组",
        "description": "因子描述",
        "window": 20,
        "dependencies": ["close"],
        "source": "因子源码"
    }
    """
    # Models sometimes omit `source` when tool-calling; use a safe default template.
    src = (body.source or "").strip()
    if not src:
        src = NEW_FACTOR_TEMPLATE.replace("class NewFactor(", f"class {body.name}(")
        src = src.replace('name = ""', f'name = "{body.name}"')
        body = body.model_copy(update={"source": src})

    rec = create_factor_controller(body)

    return factor_detail(rec).model_dump()


@tool(description="按 factor_id 查询因子详情；不存在时报错。")
def get_factor_detail(factor_id: str) -> dict[str, Any]:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool(description="获取因子列表。")
def get_factor_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_factors()]


@tool(description="更新因子并返回更新后的详情；不存在时报错。")
def update_factor(factor_id: str, body: FactorPatch) -> dict[str, Any]:
    rec = update_factor_controller(factor_id, body)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool(description="删除因子并返回删除前记录；不存在时报错。")
def delete_factor(factor_id: str) -> dict[str, Any]:
    rec = FactorItemsRegistry.delete_item(factor_id)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return rec.model_dump()


FACTOR_CHAT_TOOLS = [
    get_new_factor_template,
    create_factor,
    get_factor_detail,
    get_factor_list,
    update_factor,
    delete_factor,
]
