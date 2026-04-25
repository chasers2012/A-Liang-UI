from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.strategy.controller import (
    create_strategy as create_strategy_service,
)
from app.strategy.controller import (
    delete_strategy as delete_strategy_service,
)
from app.strategy.controller import (
    get_strategy as get_strategy_service,
)
from app.strategy.controller import (
    get_strategy_workflow_template as get_strategy_workflow_template_service,
)
from app.strategy.controller import (
    list_strategies as list_strategies_service,
)
from app.strategy.controller import (
    patch_strategy as patch_strategy_service,
)
from app.strategy.controller import (
    validate_strategy as validate_strategy_service,
)
from app.strategy.schemas import StrategyCreate, StrategyPatch


@tool("获取策略工作流模板", description="获取策略工作流模板。")
def get_strategy_workflow_template() -> dict[str, Any]:
    return get_strategy_workflow_template_service()


@tool(
    "创建策略",
    description="创建策略并持久化；入参 body（name、description、workflow），返回创建后的策略详情。",
)
def create_strategy(body: StrategyCreate) -> dict[str, Any]:
    return create_strategy_service(body)


@tool("获取策略详情", description="按 strategy_id 查询策略详情；不存在时报错。")
def get_strategy_detail(strategy_id: str) -> dict[str, Any]:
    return get_strategy_service(strategy_id)


@tool("获取策略列表", description="获取当前工作区的策略列表。")
def get_strategy_list() -> list[dict[str, Any]]:
    return [i.model_dump() for i in list_strategies_service()]


@tool(
    "更新策略",
    description="更新策略并返回更新后的详情；仅更新传入字段，语义与 PATCH /strategies/{id} 一致。",
)
def update_strategy(strategy_id: str, body: StrategyPatch) -> dict[str, Any]:
    return patch_strategy_service(strategy_id, body)


@tool("删除策略", description="删除策略并返回删除前记录；不存在时报错。")
def delete_strategy(strategy_id: str) -> dict[str, Any]:
    row = get_strategy_service(strategy_id)
    delete_strategy_service(strategy_id)
    return row


@tool("校验策略", description="校验策略 workflow；入参 strategy_id，返回 {ok, errors}。")
def validate_strategy(strategy_id: str) -> dict[str, Any]:
    return validate_strategy_service(strategy_id).model_dump()


STRATEGY_CHAT_TOOLS = [
    get_strategy_workflow_template,
    create_strategy,
    get_strategy_detail,
    get_strategy_list,
    update_strategy,
    delete_strategy,
    validate_strategy,
]
