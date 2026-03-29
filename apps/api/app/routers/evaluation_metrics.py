from __future__ import annotations

from custom_code import validate_identifier_name as validate_factor_name
from custom_code import validate_source_syntax
from evaluate import load_evaluation_metric_class
from fastapi import APIRouter, HTTPException

from app.evaluation.metrics.builtin_metric_registry import is_builtin_metric_id
from app.evaluation.metrics.metric_schemas import (
    EvaluationMetricCreate,
    EvaluationMetricDetailPublic,
    EvaluationMetricPatch,
    EvaluationMetricRecord,
    EvaluationMetricSummaryPublic,
    default_metric_source,
    new_metric_id,
    record_to_summary,
    utc_now_iso,
)
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry

router = APIRouter(prefix="/evaluation-metrics", tags=["evaluation-metrics"])


def _detail(rec) -> EvaluationMetricDetailPublic:
    summary = record_to_summary(rec)
    return EvaluationMetricDetailPublic(
        **summary.model_dump(), source=EvaluationMetricsRegistry.read_source(rec)
    )


def _merge_patch(rec, patch: EvaluationMetricPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        v = data["name"]
        if v is None or not str(v).strip():
            raise ValueError("name 不能为空")
        rec.name = str(v).strip()
    if "description" in data:
        rec.description = (data["description"] or "").strip()


def _validate_http_name_for_patch(body: EvaluationMetricPatch) -> None:
    if body.name is None or not str(body.name).strip():
        raise HTTPException(status_code=400, detail="name 不能为空")
    try:
        validate_factor_name(str(body.name))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _validate_and_write_source(rec, source: str) -> None:
    try:
        EvaluationMetricsRegistry.write_source(
            rec,
            source,
            validators=[validate_source_syntax, load_evaluation_metric_class],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _metric_sort_key(rec) -> tuple[bool, str]:
    return (not rec.builtin, rec.name)


@router.get("", response_model=list[EvaluationMetricSummaryPublic])
def list_evaluation_metrics() -> list[EvaluationMetricSummaryPublic]:
    items = sorted(EvaluationMetricsRegistry.list_items(), key=_metric_sort_key)
    return [record_to_summary(i) for i in items]


@router.get("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def get_evaluation_metric(metric_id: str) -> EvaluationMetricDetailPublic:
    rec = EvaluationMetricsRegistry.get_item(metric_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    return _detail(rec)


@router.post("", response_model=EvaluationMetricDetailPublic)
def create_evaluation_metric(body: EvaluationMetricCreate) -> EvaluationMetricDetailPublic:
    try:
        validate_factor_name(body.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    mid = new_metric_id()
    now = utc_now_iso()
    rec = body.to_record(mid, now)
    src = body.source if body.source is not None else default_metric_source(rec.name)
    try:
        EvaluationMetricsRegistry.write_source(
            rec,
            src,
            validators=[validate_source_syntax, load_evaluation_metric_class],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    EvaluationMetricsRegistry.add_item(rec)
    return _detail(rec)


def _is_protected_builtin(rec, metric_id: str) -> bool:
    return rec.builtin or is_builtin_metric_id(metric_id)


@router.patch("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def patch_evaluation_metric(
    metric_id: str, body: EvaluationMetricPatch
) -> EvaluationMetricDetailPublic:
    unset = body.model_dump(exclude_unset=True)
    if "name" in unset:
        _validate_http_name_for_patch(body)

    def _apply(rec: EvaluationMetricRecord) -> None:
        if _is_protected_builtin(rec, metric_id):
            raise HTTPException(status_code=400, detail="内置指标不可修改")
        try:
            _merge_patch(rec, body)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        if "workflow_parameters" in unset and body.workflow_parameters is not None:
            rec.workflow_parameters = list(body.workflow_parameters)
        if "source" in unset and body.source is not None:
            _validate_and_write_source(rec, body.source)
        rec.updated_at = utc_now_iso()

    rec = EvaluationMetricsRegistry.update_item(metric_id, _apply)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    return _detail(rec)


@router.delete("/{metric_id}", status_code=204)
def delete_evaluation_metric(metric_id: str) -> None:
    rec = EvaluationMetricsRegistry.get_item(metric_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    if _is_protected_builtin(rec, metric_id):
        raise HTTPException(status_code=400, detail="内置指标不可删除")
    EvaluationMetricsRegistry.delete_source_file(rec)
    EvaluationMetricsRegistry.delete_item(metric_id)
