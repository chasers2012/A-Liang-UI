from __future__ import annotations

import contextlib

from fastapi import APIRouter, Body, HTTPException

from app.evaluation_run.evaluations_store import delete_evaluation_for_factor
from app.evaluation_run.schemas import (
    FactorEvaluationRowPublic,
    FactorEvaluationRunBody,
    FactorEvaluationsAggregatePublic,
    FactorEvaluationsSummaryPublic,
)
from app.evaluation_run.service import execute_and_persist_factor_evaluation_run
from app.factors.constants import NEW_FACTOR_TEMPLATE
from app.factors.registry import FactorItemsRegistry, delete_source_file, read_source
from app.factors.schemas import (
    FactorCreate,
    FactorDetailPublic,
    FactorPatch,
    FactorRecord,
    FactorSummaryPublic,
    record_to_summary,
)
from app.http_errors import http_bad_request, http_internal_server_error

router = APIRouter(prefix="/factors", tags=["factors"])

PRIMARY_IC_PERIOD = "5"


def _detail(rec: FactorRecord) -> FactorDetailPublic:
    summary = record_to_summary(rec)
    return FactorDetailPublic(**summary.model_dump(), source=read_source(rec))


@router.get("", response_model=list[FactorSummaryPublic])
def list_factors() -> list[FactorSummaryPublic]:
    return [record_to_summary(i) for i in FactorItemsRegistry.list_items()]


@router.get("/evaluations/summary", response_model=FactorEvaluationsSummaryPublic)
def factor_evaluations_summary() -> FactorEvaluationsSummaryPublic:
    from app.evaluation_run.evaluations_store import load_evaluations_file

    try:
        ev_file = load_evaluations_file()
    except ValueError as e:
        http_internal_server_error(e)

    items = FactorItemsRegistry.list_items()
    rows: list[FactorEvaluationRowPublic] = []
    ic_for_avg: list[float] = []
    evaluated_ok = 0

    for rec in items:
        ev_rec = ev_file.items.get(rec.id)
        if ev_rec is None:
            rows.append(
                FactorEvaluationRowPublic(
                    factor_id=rec.id,
                    name=rec.name,
                    has_evaluation=False,
                )
            )
            continue

        err_raw = (ev_rec.error or "").strip()
        err: str | None = err_raw or None
        success = err is None
        if success:
            evaluated_ok += 1

        rows.append(
            FactorEvaluationRowPublic(
                factor_id=rec.id,
                name=rec.name,
                has_evaluation=True,
                evaluated_at=ev_rec.evaluated_at,
                error=err,
                evaluation_profile_id=ev_rec.evaluation_profile_id,
                results=ev_rec.results,
            )
        )

    total = len(items)
    mean_ic_primary: float | None = None
    if ic_for_avg:
        mean_ic_primary = sum(ic_for_avg) / len(ic_for_avg)

    aggregate = FactorEvaluationsAggregatePublic(
        total_factors=total,
        evaluated_count=evaluated_ok,
        unevaluated_count=total - evaluated_ok,
        primary_period=PRIMARY_IC_PERIOD,
        mean_ic_primary_avg=mean_ic_primary,
    )
    return FactorEvaluationsSummaryPublic(aggregate=aggregate, rows=rows)


@router.post(
    "/{factor_id}/evaluations/run",
    response_model=FactorEvaluationRowPublic,
)
def post_factor_evaluation_run(
    factor_id: str,
    body: FactorEvaluationRunBody | None = Body(default=None),
) -> FactorEvaluationRowPublic:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    b = body or FactorEvaluationRunBody()
    pid = (b.evaluation_profile_id or "").strip() if b.evaluation_profile_id else ""
    if not pid:
        raise HTTPException(status_code=400, detail="未指定评价方案")
    from app.evaluation.scheme.profiles_store import EvaluationProfilesRegistry

    prof = EvaluationProfilesRegistry.get_by_id(pid)
    if prof is None:
        raise HTTPException(status_code=400, detail="评价方案不存在")

    try:
        eval_rec = execute_and_persist_factor_evaluation_run(
            factor_id,
            evaluation_profile=prof,
        )
    except ValueError as e:
        http_bad_request(e)
    err_raw = (eval_rec.error or "").strip()
    err: str | None = err_raw or None
    return FactorEvaluationRowPublic(
        factor_id=factor_id,
        name=rec.name,
        has_evaluation=True,
        evaluated_at=eval_rec.evaluated_at,
        error=err,
        evaluation_profile_id=eval_rec.evaluation_profile_id,
        results=eval_rec.results,
    )


@router.get("/template", response_model=str)
def get_default_factor_source() -> str:
    return NEW_FACTOR_TEMPLATE


@router.get("/{factor_id}", response_model=FactorDetailPublic)
def get_factor(factor_id: str) -> FactorDetailPublic:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    return _detail(rec)


@router.post("", response_model=FactorDetailPublic)
def create_factor(body: FactorCreate) -> FactorDetailPublic:
    try:
        rec = FactorItemsRegistry.create_factor(body)
    except ValueError as e:
        http_bad_request(e)
    return _detail(rec)


@router.patch("/{factor_id}", response_model=FactorDetailPublic)
def patch_factor(factor_id: str, body: FactorPatch) -> FactorDetailPublic:
    try:
        rec = FactorItemsRegistry.update_factor(factor_id, body)
    except ValueError as e:
        http_bad_request(e)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    return _detail(rec)


@router.delete("/{factor_id}", status_code=204)
def delete_factor(factor_id: str) -> None:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    delete_source_file(rec)
    FactorItemsRegistry.delete_item(factor_id)
    with contextlib.suppress(ValueError):
        delete_evaluation_for_factor(factor_id)
