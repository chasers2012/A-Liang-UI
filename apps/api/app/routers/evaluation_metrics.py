from __future__ import annotations

from custom_code import validate_source_syntax
from fastapi import APIRouter, HTTPException

from app.datetime_utils import utc_now_iso
from app.evaluation.metrics.constants import DEFAULT_METRIC_SOURCE
from app.evaluation.metrics.metric_package_manager import EvaluationMetricPackageManager
from app.evaluation.metrics.metric_schemas import (
    EvaluationMetricCreate,
    EvaluationMetricDetailPublic,
    EvaluationMetricPatch,
    EvaluationMetricRecord,
    EvaluationMetricSummaryPublic,
    new_metric_id,
    record_to_summary,
)
from app.evaluation.metrics.metrics_store import EvaluationMetricsRegistry

router = APIRouter(prefix="/evaluation-metrics", tags=["evaluation-metrics"])


def _detail(rec: EvaluationMetricRecord) -> EvaluationMetricDetailPublic:
    summary = record_to_summary(rec)
    return EvaluationMetricDetailPublic(
        **summary.model_dump(), source=EvaluationMetricsRegistry.read_source(rec)
    )


def _merge_patch(rec: EvaluationMetricRecord, patch: EvaluationMetricPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        rec.name = data["name"]
    if "description" in data:
        rec.description = (data["description"] or "").strip()


def _validate_and_write_source(rec: EvaluationMetricRecord, source: str) -> None:
    try:
        EvaluationMetricsRegistry.write_source(
            rec,
            source,
            validators=[
                validate_source_syntax,
                EvaluationMetricPackageManager.load_user_evaluation_metric_class,
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("", response_model=list[EvaluationMetricSummaryPublic])
def list_evaluation_metrics() -> list[EvaluationMetricSummaryPublic]:
    items = EvaluationMetricsRegistry.list_items()
    return [record_to_summary(i) for i in items]


@router.get("/template", response_model=str)
def get_evaluation_metric_template() -> str:
    return DEFAULT_METRIC_SOURCE


@router.get("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def get_evaluation_metric(metric_id: str) -> EvaluationMetricDetailPublic:
    rec = EvaluationMetricsRegistry.get_item(metric_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    return _detail(rec)


@router.post("", response_model=EvaluationMetricDetailPublic)
def create_evaluation_metric(body: EvaluationMetricCreate) -> EvaluationMetricDetailPublic:
    mid = new_metric_id()
    now = utc_now_iso()
    rec = body.to_record(mid, now)
    try:
        EvaluationMetricPackageManager.write_metric_package(
            mid,
            body.source,
            validators=[
                validate_source_syntax,
                EvaluationMetricPackageManager.load_user_evaluation_metric_class,
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    EvaluationMetricsRegistry.add_item(rec)
    return _detail(rec)


@router.patch("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def patch_evaluation_metric(
    metric_id: str, body: EvaluationMetricPatch
) -> EvaluationMetricDetailPublic:
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec: EvaluationMetricRecord) -> None:
        _merge_patch(rec, body)
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
    EvaluationMetricPackageManager.delete_user_metric_package(metric_id)
    EvaluationMetricsRegistry.delete_item(metric_id)
