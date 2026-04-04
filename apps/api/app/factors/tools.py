from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.factors.registry import FactorItemsRegistry, factor_detail
from app.factors.schemas import FactorCreate, FactorPatch
from app.routers.factors import list_factors


@tool(
    description=(
        "获取新因子源码模板（NEW_FACTOR_TEMPLATE）。"
        "你可以先调用本工具拿到模板，再基于模板生成完整可运行的因子源码字符串；"
        "最后用 create_factor(body={name, group, description, max_window, dependencies, source}) 保存。"
    )
)
def get_new_factor_template() -> str:
    return NEW_FACTOR_TEMPLATE


@tool(
    description=(
        "创建并保存一个因子，返回所创建的因子详情。"
        "入参 body 必须包含 name（合法 Python 标识符），并同时提供 source（完整 Python 源码字符串）。"
    )
)
def create_factor(body: FactorCreate) -> dict[str, Any]:
    """
    body: FactorCreate = {
        "name": "因子名称",
        "group": "因子组",
        "description": "因子描述",
        "max_window": 20,
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

    rec = FactorItemsRegistry.create_factor(body)

    return factor_detail(rec).model_dump()


@tool(description="获取因子详情，返回所获取的因子详情")
def get_factor_detail(factor_id: str) -> dict[str, Any]:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool(description="获取因子列表，返回所获取的因子列表")
def get_factor_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_factors()]


@tool(description="更新因子，返回所更新的因子详情")
def update_factor(factor_id: str, body: FactorPatch) -> dict[str, Any]:
    rec = FactorItemsRegistry.update_item(factor_id, body)
    if rec is None:
        raise ValueError(f"因子 {factor_id} 不存在")
    return factor_detail(rec).model_dump()


@tool(description="删除因子，返回所删除的因子详情")
def delete_factor(factor_id: str) -> dict[str, Any]:
    return FactorItemsRegistry.delete_item(factor_id)


FACTOR_CHAT_TOOLS = [
    get_new_factor_template,
    create_factor,
    get_factor_detail,
    get_factor_list,
    update_factor,
    delete_factor,
]
