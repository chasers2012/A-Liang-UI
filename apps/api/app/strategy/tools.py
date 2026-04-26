from __future__ import annotations

from typing import Any

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
from app.tool.safe_tool import safe_tool


@safe_tool(
    "获取策略工作流模板",
    description="获取策略工作流模板。\n用于初始化策略编辑结构，后续可基于模板填充节点与连线。",
)
def get_strategy_workflow_template() -> dict[str, Any]:
    return get_strategy_workflow_template_service()


@safe_tool(
    "创建策略",
    description="创建并保存策略。\n入参 body 包含 name/description/workflow；返回创建后的策略详情。",
)
def create_strategy(body: StrategyCreate) -> dict[str, Any]:
    return create_strategy_service(body)


@safe_tool("获取策略详情", description="查询单个策略详情。\n入参 strategy_id；不存在需报错。")
def get_strategy_detail(strategy_id: str) -> dict[str, Any]:
    return get_strategy_service(strategy_id)


@safe_tool(
    "获取策略列表",
    description="查询当前工作区策略列表。\n返回策略列表用于选择运行或编辑目标。",
)
def get_strategy_list() -> list[dict[str, Any]]:
    return [i.model_dump() for i in list_strategies_service()]


@safe_tool(
    "更新策略",
    description="更新策略配置。\n入参 strategy_id 与 StrategyPatch；仅更新传入字段，语义与 PATCH 接口一致。",
)
def update_strategy(strategy_id: str, body: StrategyPatch) -> dict[str, Any]:
    return patch_strategy_service(strategy_id, body)


@safe_tool("删除策略", description="删除指定策略。\n入参 strategy_id；返回删除前记录。")
def delete_strategy(strategy_id: str) -> dict[str, Any]:
    row = get_strategy_service(strategy_id)
    delete_strategy_service(strategy_id)
    return row


@safe_tool(
    "校验策略",
    description="校验策略 workflow。\n入参 strategy_id；返回 {ok, errors} 供修正流程使用。",
)
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
