from __future__ import annotations

import contextlib

from fastapi import APIRouter, Body, HTTPException

from app.evaluation.run.controller import delete_evaluation_runs_for_factor
from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.factors.schemas import FactorDetailPublic, FactorSummaryPublic
from app.http_errors import http_bad_request

from . import controller

router = APIRouter(prefix="/factors", tags=["factors"])


@router.get("", response_model=list[FactorSummaryPublic])
def get_factor_list() -> list[FactorSummaryPublic]:
    return controller.list_factors()


@router.get("/template", response_model=str)
def get_default_factor_source() -> str:
    return NEW_FACTOR_TEMPLATE


@router.get("/{factor_id}", response_model=FactorDetailPublic)
def get_factor(factor_id: str) -> FactorDetailPublic:
    try:
        return controller.get_factor_detail_by_id(factor_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail="因子不存在") from e


@router.post("", response_model=FactorDetailPublic)
def create_factor(source: str = Body(...)) -> FactorDetailPublic:
    try:
        rec = controller.create_factor(source)
    except ValueError as e:
        http_bad_request(e)
    return controller.factor_detail(rec)


@router.patch("/{factor_id}", response_model=FactorDetailPublic)
def patch_factor(factor_id: str, source: str = Body(...)) -> FactorDetailPublic:
    try:
        rec = controller.update_factor(factor_id, source)
    except ValueError as e:
        http_bad_request(e)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    return controller.factor_detail(rec)


@router.delete("/{factor_id}", status_code=204)
def delete_factor(factor_id: str) -> None:
    try:
        controller.delete_factor(factor_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail="因子不存在") from e
    with contextlib.suppress(ValueError):
        delete_evaluation_runs_for_factor(factor_id)
