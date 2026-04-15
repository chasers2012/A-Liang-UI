from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool

from app.datasource.schemas import utc_now_iso
from app.strategy.controller import validate_strategy_workflow_only
from app.strategy.models import StrategyRow
from app.strategy.registry import StrategyRegistry
from app.strategy.schemas import (
    StrategyCreate,
    StrategyPatch,
    StrategyPreviewResponse,
    StrategyValidateResponse,
    workflow_public_dict,
)


def _to_public_dict(row: StrategyRow) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "workflow": workflow_public_dict(row.workflow),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@tool(
    description="创建策略并持久化；入参 body（name、description、workflow），返回创建后的策略详情。"
)
def create_strategy(body: StrategyCreate) -> dict[str, Any]:
    row = body.to_row()
    StrategyRegistry.save(row)
    return _to_public_dict(row)


@tool(description="按 strategy_id 查询策略详情；不存在时报错。")
def get_strategy_detail(strategy_id: str) -> dict[str, Any]:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise ValueError("策略不存在")
    return _to_public_dict(row)


@tool(description="获取当前工作区的策略列表。")
def get_strategy_list() -> list[dict[str, Any]]:
    return [_to_public_dict(row) for row in StrategyRegistry.list_all()]


@tool(
    description="更新策略并返回更新后的详情；仅更新传入字段，语义与 PATCH /strategies/{id} 一致。"
)
def update_strategy(strategy_id: str, body: StrategyPatch) -> dict[str, Any]:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise ValueError("策略不存在")

    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        if body.name is None or not str(body.name).strip():
            raise ValueError("name 不能为空")
        row.name = str(body.name).strip()
    if "description" in data:
        row.description = (body.description or "").strip()
    if "workflow" in data and body.workflow is not None:
        row.workflow = json.dumps(body.workflow, ensure_ascii=False)
    row.updated_at = utc_now_iso()

    StrategyRegistry.save(row)
    return _to_public_dict(row)


@tool(description="删除策略并返回删除前记录；不存在时报错。")
def delete_strategy(strategy_id: str) -> dict[str, Any]:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise ValueError("策略不存在")
    if not StrategyRegistry.delete_by_id(strategy_id):
        raise ValueError("策略不存在")
    return _to_public_dict(row)


@tool(description="校验策略 workflow；入参 strategy_id，返回 {ok, errors}。")
def validate_strategy(strategy_id: str) -> dict[str, Any]:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise ValueError("策略不存在")
    res: StrategyValidateResponse = validate_strategy_workflow_only(row.workflow)
    return res.model_dump()


@tool(description="获取策略预览信息；入参 strategy_id，当前返回占位 preview 对象。")
def preview_strategy(strategy_id: str) -> dict[str, Any]:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise ValueError("策略不存在")
    res = StrategyPreviewResponse(ok=True, preview={})
    return res.model_dump()


STRATEGY_CHAT_TOOLS = [
    create_strategy,
    get_strategy_detail,
    get_strategy_list,
    update_strategy,
    delete_strategy,
    validate_strategy,
    preview_strategy,
]
