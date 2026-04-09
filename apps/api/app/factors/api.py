from __future__ import annotations

import contextlib

from fastapi import APIRouter, HTTPException

from app.evaluation.run.controller import delete_evaluation_runs_for_factor
from app.evaluation.run.redistry import EvaluationRunsStore
from app.evaluation.run.schemas import (
    EvaluationRunRecord,
    EvaluationRunRowPublic,
    EvaluationRunsAggregatePublic,
    EvaluationRunsSummaryPublic,
)
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

PRIMARY_IC_PERIOD = "5"


@router.get("", response_model=list[FactorSummaryPublic])
def get_factor_list() -> list[FactorSummaryPublic]:
    return list_factors()


@router.get("/evaluations/summary", response_model=EvaluationRunsSummaryPublic)
def evaluation_runs_summary() -> EvaluationRunsSummaryPublic:
    items = FactorItemsRegistry.list_items()
    rows: list[EvaluationRunRowPublic] = []
    ic_for_avg: list[float] = []
    evaluated_ok = 0
    latest_eval_runs_by_factor_id: dict[str, EvaluationRunRecord] = {}
    for run in EvaluationRunsStore.list_items():
        current = latest_eval_runs_by_factor_id.get(run.factor_id)
        if current is None or run.end_at > current.end_at:
            latest_eval_runs_by_factor_id[run.factor_id] = run

    for rec in items:
        ev_rec = latest_eval_runs_by_factor_id.get(rec.id)
        if ev_rec is None:
            rows.append(
                EvaluationRunRowPublic(
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
            EvaluationRunRowPublic(
                id=ev_rec.id,
                factor_id=rec.id,
                name=rec.name,
                has_evaluation=True,
                evaluated_at=ev_rec.end_at.isoformat(),
                error=err,
                evaluation_profile_id=ev_rec.evaluation_profile_id,
                results=ev_rec.results,
            )
        )

    total = len(items)
    mean_ic_primary: float | None = None
    if ic_for_avg:
        mean_ic_primary = sum(ic_for_avg) / len(ic_for_avg)

    aggregate = EvaluationRunsAggregatePublic(
        total_factors=total,
        evaluated_count=evaluated_ok,
        unevaluated_count=total - evaluated_ok,
        primary_period=PRIMARY_IC_PERIOD,
        mean_ic_primary_avg=mean_ic_primary,
    )
    return EvaluationRunsSummaryPublic(aggregate=aggregate, rows=rows)


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
