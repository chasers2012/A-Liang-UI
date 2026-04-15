from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.datasource.schemas import utc_now_iso
from app.strategy.controller import validate_strategy_workflow_only
from app.strategy.models import StrategyRow
from app.strategy.registry import StrategyRegistry
from app.strategy.schemas import (
    StrategyCreate,
    StrategyPatch,
    StrategyPreviewResponse,
    StrategyPublic,
    StrategyValidateResponse,
    workflow_public_dict,
)

router = APIRouter(prefix="/strategies", tags=["strategies"])


def _to_public(row: StrategyRow) -> StrategyPublic:
    return StrategyPublic(
        id=row.id,
        name=row.name,
        description=row.description,
        workflow=workflow_public_dict(row.workflow),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _merge_strategy_patch(row: StrategyRow, body: StrategyPatch, data: dict[str, object]) -> None:
    if "name" in data:
        if body.name is None or not str(body.name).strip():
            raise HTTPException(status_code=400, detail="name 不能为空")
        row.name = str(body.name).strip()
    if "description" in data:
        row.description = (body.description or "").strip()
    if "workflow" in data and body.workflow is not None:
        row.workflow = json.dumps(body.workflow, ensure_ascii=False)
    row.updated_at = utc_now_iso()


@router.get("", response_model=list[StrategyPublic])
def list_strategies() -> list[StrategyPublic]:
    return [_to_public(i) for i in StrategyRegistry.list_all()]


@router.get("/{strategy_id}", response_model=StrategyPublic)
def get_strategy(strategy_id: str) -> StrategyPublic:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return _to_public(row)


@router.post("", response_model=StrategyPublic)
def create_strategy(body: StrategyCreate) -> StrategyPublic:
    row = body.to_row()
    StrategyRegistry.save(row)
    return _to_public(row)


@router.patch("/{strategy_id}", response_model=StrategyPublic)
def patch_strategy(strategy_id: str, body: StrategyPatch) -> StrategyPublic:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    data = body.model_dump(exclude_unset=True)
    _merge_strategy_patch(row, body, data)
    StrategyRegistry.save(row)
    return _to_public(row)


@router.delete("/{strategy_id}", status_code=204)
def delete_strategy(strategy_id: str) -> None:
    if not StrategyRegistry.delete_by_id(strategy_id):
        raise HTTPException(status_code=404, detail="策略不存在")


@router.post("/{strategy_id}/validate", response_model=StrategyValidateResponse)
def validate_strategy(strategy_id: str) -> StrategyValidateResponse:
    row = StrategyRegistry.get_by_id(strategy_id)
    if row is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return validate_strategy_workflow_only(row.workflow)


@router.post("/{strategy_id}/preview", response_model=StrategyPreviewResponse)
def preview_strategy(strategy_id: str) -> StrategyPreviewResponse:
    rec = StrategyRegistry.get_by_id(strategy_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return StrategyPreviewResponse(ok=True, preview={})
