from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.strategy.controller import (
    create_strategy,
    delete_strategy,
    get_strategy,
    get_strategy_workflow_template,
    list_strategies,
    patch_strategy,
    validate_strategy,
)
from app.strategy.schemas import (
    StrategyCreate,
    StrategyListPublic,
    StrategyPatch,
    StrategyPublic,
    StrategyValidateResponse,
)

router = APIRouter(prefix="/strategies", tags=["strategies"])


@router.get("/workflow-template", response_model=dict)
def get_workflow_template() -> dict:
    return get_strategy_workflow_template()


@router.get("", response_model=list[StrategyListPublic])
def list_strategies_route() -> list[StrategyListPublic]:
    return list_strategies()


@router.get("/{strategy_id}", response_model=StrategyPublic)
def get_strategy_route(strategy_id: str) -> StrategyPublic:
    strategy = get_strategy(strategy_id)
    if strategy is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return strategy


@router.post("", response_model=StrategyPublic)
def create_strategy_route(body: StrategyCreate) -> StrategyPublic:
    return create_strategy(body)


@router.patch("/{strategy_id}", response_model=StrategyPublic)
def patch_strategy_route(strategy_id: str, body: StrategyPatch) -> StrategyPublic:
    strategy = patch_strategy(strategy_id, body)
    if strategy is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return strategy


@router.delete("/{strategy_id}", status_code=204)
def delete_strategy_route(strategy_id: str) -> None:
    if not delete_strategy(strategy_id):
        raise HTTPException(status_code=404, detail="策略不存在")


@router.post("/{strategy_id}/validate", response_model=StrategyValidateResponse)
def validate_strategy_route(strategy_id: str) -> StrategyValidateResponse:
    strategy_validate = validate_strategy(strategy_id)
    if strategy_validate is None:
        raise HTTPException(status_code=404, detail="策略不存在")
    return strategy_validate
