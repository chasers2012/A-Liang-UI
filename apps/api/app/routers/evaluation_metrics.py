from __future__ import annotations

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
    metric_source_validators,
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


@router.get("", response_model=list[EvaluationMetricSummaryPublic])
def list_evaluation_metrics() -> list[EvaluationMetricSummaryPublic]:
    """获取评价指标列表"""
    items = EvaluationMetricsRegistry.list_items()
    return [record_to_summary(i) for i in items]


@router.get("/template", response_model=str)
def get_evaluation_metric_template() -> str:
    """获取评价指标模板"""
    return DEFAULT_METRIC_SOURCE


@router.post("", response_model=EvaluationMetricDetailPublic)
def create_evaluation_metric(body: EvaluationMetricCreate) -> EvaluationMetricDetailPublic:
    """创建评价指标"""

    try:
        rec = EvaluationMetricsRegistry.create_evaluation_metric(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _detail(rec)


@router.get("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def get_evaluation_metric(metric_id: str) -> EvaluationMetricDetailPublic:
    """获取评价指标详情"""
    rec = EvaluationMetricsRegistry.get_item(metric_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    return _detail(rec)


@router.patch("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def patch_evaluation_metric(
    metric_id: str, body: EvaluationMetricPatch
) -> EvaluationMetricDetailPublic:
    """修改评价指标"""
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec: EvaluationMetricRecord) -> None:
        _merge_patch(rec, body)
        if "workflow_parameters" in unset and body.workflow_parameters is not None:
            rec.workflow_parameters = list(body.workflow_parameters)
        if "source" in unset and body.source is not None:
            try:
                EvaluationMetricsRegistry.write_source(
                    rec,
                    body.source,
                    validators=metric_source_validators,
                )
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        rec.updated_at = utc_now_iso()

    rec = EvaluationMetricsRegistry.update_item(metric_id, _apply)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    return _detail(rec)


@router.delete("/{metric_id}", status_code=204)
def delete_evaluation_metric(metric_id: str) -> None:
    """删除评价指标"""
    rec = EvaluationMetricsRegistry.get_item(metric_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    EvaluationMetricPackageManager.delete_evaluation_metric_package(metric_id)
    EvaluationMetricsRegistry.delete_item(metric_id)
