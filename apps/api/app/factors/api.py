from __future__ import annotations

import contextlib

from fastapi import APIRouter, HTTPException

from app.evaluation.run.controller import delete_evaluation_runs_for_factor
from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.factors.controller import (
    create_factor as create_factor_record,
)
from app.factors.controller import (
    delete_factor_source_file,
    factor_detail,
    list_factors,
    update_factor,
)
from app.factors.registry import FactorItemsRegistry
from app.factors.schemas import (
    FactorCreate,
    FactorDetailPublic,
    FactorPatch,
    FactorSummaryPublic,
)
from app.http_errors import http_bad_request

router = APIRouter(prefix="/factors", tags=["factors"])


@router.get("", response_model=list[FactorSummaryPublic])
def get_factor_list() -> list[FactorSummaryPublic]:
    return list_factors()


@router.get("/template", response_model=str)
def get_default_factor_source() -> str:
    return NEW_FACTOR_TEMPLATE


@router.get("/{factor_id}", response_model=FactorDetailPublic)
def get_factor(factor_id: str) -> FactorDetailPublic:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    return factor_detail(rec)


@router.post("", response_model=FactorDetailPublic)
def create_factor(body: FactorCreate) -> FactorDetailPublic:
    try:
        rec = create_factor_record(body)
    except ValueError as e:
        http_bad_request(e)
    return factor_detail(rec)


@router.patch("/{factor_id}", response_model=FactorDetailPublic)
def patch_factor(factor_id: str, body: FactorPatch) -> FactorDetailPublic:
    try:
        rec = update_factor(factor_id, body)
    except ValueError as e:
        http_bad_request(e)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    return factor_detail(rec)


@router.delete("/{factor_id}", status_code=204)
def delete_factor(factor_id: str) -> None:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    delete_factor_source_file(rec)
    FactorItemsRegistry.delete_item(factor_id)
    with contextlib.suppress(ValueError):
        delete_evaluation_runs_for_factor(factor_id)
