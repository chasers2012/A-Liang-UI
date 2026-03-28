from __future__ import annotations

import contextlib

from fastapi import APIRouter, Body, HTTPException, Query

from app.factors.code_snapshot_schemas import (
    FactorCodeSnapshotDetailPublic,
    FactorCodeSnapshotSummaryPublic,
)
from app.factors.code_snapshots_store import (
    append_code_snapshot,
    delete_snapshots_for_factor,
    get_snapshot,
    list_snapshots_for_factor,
)
from app.factors.evaluation_history_schemas import FactorEvaluationHistoryEntry
from app.factors.evaluation_history_store import (
    append_history_entry,
    delete_history_for_factor,
    entry_from_latest_evaluation,
    list_history_for_factor,
)
from app.factors.evaluation_runner import run_evaluation_for_factor
from app.factors.evaluation_schemas import (
    FactorEvaluationRowPublic,
    FactorEvaluationRunBody,
    FactorEvaluationsAggregatePublic,
    FactorEvaluationsSummaryPublic,
)
from app.factors.evaluations_store import (
    delete_evaluation_for_factor,
    load_evaluations_file,
    upsert_evaluation_for_factor,
)
from app.factors.registry import (
    delete_source_file,
    get_by_id,
    load_registry,
    read_source,
    save_registry,
    write_source,
)
from app.factors.schemas import (
    FactorCreate,
    FactorDefaultSourcePublic,
    FactorDetailPublic,
    FactorPatch,
    FactorRecord,
    FactorSummaryPublic,
    default_factor_source,
    new_factor_id,
    record_to_summary,
    utc_now_iso,
)
from app.factors.validate import validate_factor_name, validate_source_syntax
from app.http_errors import http_bad_request, http_internal_server_error

router = APIRouter(prefix="/factors", tags=["factors"])

PRIMARY_IC_PERIOD = "5"


def _detail(rec: FactorRecord) -> FactorDetailPublic:
    summary = record_to_summary(rec)
    return FactorDetailPublic(**summary.model_dump(), source=read_source(rec))


def _merge_patch(rec, patch: FactorPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        v = data["name"]
        if v is None or not str(v).strip():
            raise ValueError("name 不能为空")
        rec.name = str(v).strip()
    if "group" in data:
        rec.group = (data["group"] or "").strip()
    if "description" in data:
        rec.description = (data["description"] or "").strip()
    if "max_window" in data:
        mw = data["max_window"]
        if mw is not None:
            rec.max_window = mw
    if "dependencies" in data and data["dependencies"] is not None:
        deps = [d.strip() for d in data["dependencies"] if str(d).strip()]
        if not deps:
            raise ValueError("dependencies 不能为空")
        rec.dependencies = deps


def _patch_factor_validate_and_merge(
    rec: FactorRecord,
    body: FactorPatch,
    unset: dict,
) -> None:
    if "name" in unset:
        if body.name is None or not str(body.name).strip():
            raise HTTPException(status_code=400, detail="name 不能为空")
        try:
            validate_factor_name(str(body.name))
        except ValueError as e:
            http_bad_request(e)

    if "max_window" in unset and body.max_window is not None and body.max_window < 1:
        raise HTTPException(status_code=400, detail="max_window 须 >= 1")

    try:
        _merge_patch(rec, body)
    except ValueError as e:
        http_bad_request(e)


def _apply_source_change_with_snapshot(
    factor_id: str,
    rec: FactorRecord,
    new_source: str,
) -> None:
    try:
        validate_source_syntax(new_source)
    except ValueError as e:
        http_bad_request(e)
    old_src = read_source(rec)
    if new_source == old_src:
        return
    write_source(rec, new_source)
    try:
        snap = append_code_snapshot(
            factor_id,
            rec,
            new_source,
            kind="auto",
        )
    except ValueError as e:
        http_internal_server_error(e)
    try:
        ev_file = load_evaluations_file()
    except ValueError:
        pass
    else:
        latest = ev_file.items.get(factor_id)
        if latest is not None:
            entry = entry_from_latest_evaluation(
                latest,
                linked_snapshot_id=snap.id,
            )
            with contextlib.suppress(ValueError):
                append_history_entry(factor_id, entry)


@router.get("", response_model=list[FactorSummaryPublic])
def list_factors() -> list[FactorSummaryPublic]:
    reg = load_registry()
    return [record_to_summary(i) for i in reg.items]


@router.get("/evaluations/summary", response_model=FactorEvaluationsSummaryPublic)
def factor_evaluations_summary() -> FactorEvaluationsSummaryPublic:
    try:
        ev_file = load_evaluations_file()
    except ValueError as e:
        http_internal_server_error(e)

    reg = load_registry()
    rows: list[FactorEvaluationRowPublic] = []
    ic_for_avg: list[float] = []
    evaluated_ok = 0

    for rec in reg.items:
        snap = ev_file.items.get(rec.id)
        if snap is None:
            rows.append(
                FactorEvaluationRowPublic(
                    factor_id=rec.id,
                    name=rec.name,
                    has_evaluation=False,
                )
            )
            continue

        err_raw = (snap.error or "").strip()
        err: str | None = err_raw or None
        success = err is None
        if success:
            evaluated_ok += 1
            v = snap.mean_ic.get(PRIMARY_IC_PERIOD)
            if v is not None:
                ic_for_avg.append(float(v))

        rows.append(
            FactorEvaluationRowPublic(
                factor_id=rec.id,
                name=rec.name,
                has_evaluation=True,
                evaluated_at=snap.evaluated_at,
                window=snap.window,
                stock_count=snap.stock_count,
                mean_ic=dict(snap.mean_ic),
                mean_return_spread=dict(snap.mean_return_spread),
                error=err,
                evaluation_profile_id=snap.evaluation_profile_id,
                metric_results=dict(snap.metric_results),
            )
        )

    total = len(reg.items)
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


@router.get(
    "/{factor_id}/evaluations/history",
    response_model=list[FactorEvaluationHistoryEntry],
)
def factor_evaluation_history(factor_id: str) -> list[FactorEvaluationHistoryEntry]:
    reg = load_registry()
    if get_by_id(reg, factor_id) is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    try:
        rows = list_history_for_factor(factor_id)
    except ValueError as e:
        http_internal_server_error(e)
    return list(reversed(rows))


@router.post(
    "/{factor_id}/evaluations/run",
    response_model=FactorEvaluationRowPublic,
)
def post_factor_evaluation_run(
    factor_id: str,
    body: FactorEvaluationRunBody | None = Body(default=None),
) -> FactorEvaluationRowPublic:
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    b = body or FactorEvaluationRunBody()
    ts_id = b.test_set_id
    prof = None
    pid = (b.evaluation_profile_id or "").strip() if b.evaluation_profile_id else ""
    if pid:
        from app.evaluation.scheme.graph_validate import validate_workflow_graph
        from app.evaluation.scheme.profiles_store import get_by_id as get_profile_by_id
        from app.evaluation.scheme.profiles_store import load_file as load_profiles_file
        from app.evaluation.scheme.workflow_graph_types import all_workflow_node_type_ids

        preg = load_profiles_file()
        prof = get_profile_by_id(preg, pid)
        if prof is None:
            raise HTTPException(status_code=400, detail="评价方案不存在")
        if prof.workflow.nodes:
            try:
                validate_workflow_graph(prof.workflow, allowed_types=all_workflow_node_type_ids())
            except ValueError as e:
                http_bad_request(e)
    try:
        snap = run_evaluation_for_factor(
            factor_id,
            test_set_id=ts_id,
            evaluation_profile=prof,
        )
    except ValueError as e:
        http_bad_request(e)
    try:
        upsert_evaluation_for_factor(factor_id, snap)
    except ValueError as e:
        http_internal_server_error(e)
    entry = entry_from_latest_evaluation(snap, linked_snapshot_id=None)
    with contextlib.suppress(ValueError):
        append_history_entry(factor_id, entry)
    err_raw = (snap.error or "").strip()
    err: str | None = err_raw or None
    return FactorEvaluationRowPublic(
        factor_id=factor_id,
        name=rec.name,
        has_evaluation=True,
        evaluated_at=snap.evaluated_at,
        window=snap.window,
        stock_count=snap.stock_count,
        mean_ic=dict(snap.mean_ic),
        mean_return_spread=dict(snap.mean_return_spread),
        error=err,
        evaluation_profile_id=snap.evaluation_profile_id,
        metric_results=dict(snap.metric_results),
    )


@router.get(
    "/{factor_id}/snapshots",
    response_model=list[FactorCodeSnapshotSummaryPublic],
)
def list_factor_snapshots(factor_id: str) -> list[FactorCodeSnapshotSummaryPublic]:
    reg = load_registry()
    if get_by_id(reg, factor_id) is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    try:
        snaps = list_snapshots_for_factor(factor_id)
    except ValueError as e:
        http_internal_server_error(e)
    return [
        FactorCodeSnapshotSummaryPublic(
            id=s.id,
            saved_at=s.saved_at,
            kind=s.kind,
            label=s.label,
            meta=s.meta,
        )
        for s in reversed(snaps)
    ]


@router.get(
    "/{factor_id}/snapshots/{snapshot_id}",
    response_model=FactorCodeSnapshotDetailPublic,
)
def get_factor_snapshot(
    factor_id: str,
    snapshot_id: str,
) -> FactorCodeSnapshotDetailPublic:
    reg = load_registry()
    if get_by_id(reg, factor_id) is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    try:
        snap = get_snapshot(factor_id, snapshot_id)
    except ValueError as e:
        http_internal_server_error(e)
    if snap is None:
        raise HTTPException(status_code=404, detail="快照不存在")
    return FactorCodeSnapshotDetailPublic(
        id=snap.id,
        saved_at=snap.saved_at,
        kind=snap.kind,
        label=snap.label,
        meta=snap.meta,
        source=snap.source,
    )


@router.get("/default-source", response_model=FactorDefaultSourcePublic)
def get_default_factor_source(
    name: str | None = Query(
        default=None,
        description="Embedded as UserFactor.name in the template; empty uses my_factor",
    ),
) -> FactorDefaultSourcePublic:
    return FactorDefaultSourcePublic(source=default_factor_source(name or ""))


@router.get("/{factor_id}", response_model=FactorDetailPublic)
def get_factor(factor_id: str) -> FactorDetailPublic:
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    return _detail(rec)


@router.post("", response_model=FactorDetailPublic)
def create_factor(body: FactorCreate) -> FactorDetailPublic:
    try:
        validate_factor_name(body.name)
    except ValueError as e:
        http_bad_request(e)
    fid = new_factor_id()
    now = utc_now_iso()
    rec = body.to_record(fid, now)
    src = body.source if body.source is not None else default_factor_source(rec.name)
    try:
        validate_source_syntax(src)
    except ValueError as e:
        http_bad_request(e)

    reg = load_registry()
    reg.items.append(rec)
    write_source(rec, src)
    save_registry(reg)
    return _detail(rec)


@router.patch("/{factor_id}", response_model=FactorDetailPublic)
def patch_factor(factor_id: str, body: FactorPatch) -> FactorDetailPublic:
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")

    unset = body.model_dump(exclude_unset=True)
    _patch_factor_validate_and_merge(rec, body, unset)

    if "source" in unset and body.source is not None:
        _apply_source_change_with_snapshot(factor_id, rec, body.source)

    rec.updated_at = utc_now_iso()
    save_registry(reg)
    return _detail(rec)


@router.delete("/{factor_id}", status_code=204)
def delete_factor(factor_id: str) -> None:
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    reg.items = [i for i in reg.items if i.id != factor_id]
    delete_source_file(rec)
    save_registry(reg)
    with contextlib.suppress(ValueError):
        delete_snapshots_for_factor(factor_id)
    with contextlib.suppress(ValueError):
        delete_history_for_factor(factor_id)
    with contextlib.suppress(ValueError):
        delete_evaluation_for_factor(factor_id)
