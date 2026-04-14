from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.datasource.schemas import utc_now_iso
from app.strategy.constants import empty_workflow_template_dict
from app.strategy.controller import (
    get_strategy_workflow_io_spec,
    list_strategy_node_types_public,
    validate_strategy_workflow_only,
)
from app.strategy.registry import StrategyRegistry
from app.strategy.schemas import (
    StrategyCreate,
    StrategyNodeTypePublic,
    StrategyPatch,
    StrategyPreviewResponse,
    StrategyPublic,
    StrategyRecord,
    StrategyValidateResponse,
    WorkflowIOSpecPublic,
    workflow_public_dict,
)

router = APIRouter(prefix="/strategies", tags=["strategies"])


def _to_public(rec: StrategyRecord) -> StrategyPublic:
    return StrategyPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        workflow=workflow_public_dict(rec.workflow),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _merge_strategy_patch(
    rec: StrategyRecord, body: StrategyPatch, data: dict[str, object]
) -> None:
    if "name" in data:
        if body.name is None or not str(body.name).strip():
            raise HTTPException(status_code=400, detail="name 不能为空")
        rec.name = str(body.name).strip()
    if "description" in data:
        rec.description = (body.description or "").strip()
    if "workflow" in data and body.workflow is not None:
        rec.workflow = json.dumps(body.workflow, ensure_ascii=False)
    rec.updated_at = utc_now_iso()


@router.get("/node-types", response_model=list[StrategyNodeTypePublic])
def list_node_types() -> list[StrategyNodeTypePublic]:
    return list_strategy_node_types_public()


@router.get("/workflow-io", response_model=WorkflowIOSpecPublic)
def get_workflow_io() -> WorkflowIOSpecPublic:
    return get_strategy_workflow_io_spec()


@router.get("/workflow-template", response_model=dict)
def get_workflow_template() -> dict:
    return empty_workflow_template_dict()


@router.get("", response_model=list[StrategyPublic])
def list_strategies() -> list[StrategyPublic]:
    return [_to_public(i) for i in StrategyRegistry.list_all()]


@router.get("/{strategy_id}", response_model=StrategyPublic)
def get_strategy(strategy_id: str) -> StrategyPublic:
    rec = StrategyRegistry.get_by_id(strategy_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return _to_public(rec)


@router.post("", response_model=StrategyPublic)
def create_strategy(body: StrategyCreate) -> StrategyPublic:
    rec = body.to_record()
    StrategyRegistry.save(rec)
    return _to_public(rec)


@router.patch("/{strategy_id}", response_model=StrategyPublic)
def patch_strategy(strategy_id: str, body: StrategyPatch) -> StrategyPublic:
    rec = StrategyRegistry.get_by_id(strategy_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    data = body.model_dump(exclude_unset=True)
    _merge_strategy_patch(rec, body, data)
    StrategyRegistry.save(rec)
    return _to_public(rec)


@router.delete("/{strategy_id}", status_code=204)
def delete_strategy(strategy_id: str) -> None:
    if not StrategyRegistry.delete_by_id(strategy_id):
        raise HTTPException(status_code=404, detail="策略不存在")


@router.post("/{strategy_id}/validate", response_model=StrategyValidateResponse)
def validate_strategy(strategy_id: str) -> StrategyValidateResponse:
    rec = StrategyRegistry.get_by_id(strategy_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return validate_strategy_workflow_only(rec.workflow)


@router.post("/{strategy_id}/preview", response_model=StrategyPreviewResponse)
def preview_strategy(strategy_id: str) -> StrategyPreviewResponse:
    rec = StrategyRegistry.get_by_id(strategy_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    # Engine-backed preview is implemented together with backtest engine.
    return StrategyPreviewResponse(ok=True, preview={})
