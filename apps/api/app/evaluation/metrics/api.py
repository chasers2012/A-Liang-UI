from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.datetime_utils import utc_now_iso
from app.evaluation.metrics.constants import DEFAULT_METRIC_SOURCE
from app.evaluation.metrics.metric_package_manager import EvaluationMetricPackageManager
from app.evaluation.metrics.redistry import EvaluationMetricsRegistry
from app.evaluation.metrics.schemas import (
    EvaluationMetricCreate,
    EvaluationMetricDetailPublic,
    EvaluationMetricPatch,
    EvaluationMetricRecord,
    EvaluationMetricSummaryPublic,
    metric_source_validators,
)

router = APIRouter(prefix="/evaluation-metrics", tags=["evaluation-metrics"])


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
    return [EvaluationMetricsRegistry.load_metric(i.id) for i in items]


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
    return EvaluationMetricsRegistry.load_metric(rec.id)


@router.get("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def get_evaluation_metric(metric_id: str) -> EvaluationMetricDetailPublic:
    """获取评价指标详情"""
    return EvaluationMetricsRegistry.load_metric_detail(metric_id)


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
    return EvaluationMetricsRegistry.load_metric(rec.id)


@router.delete("/{metric_id}", status_code=204)
def delete_evaluation_metric(metric_id: str) -> None:
    """删除评价指标"""
    rec = EvaluationMetricsRegistry.get_item(metric_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    EvaluationMetricPackageManager.delete_evaluation_metric_package(metric_id)
    EvaluationMetricsRegistry.delete_item(metric_id)


@router.get("/{metric_id}/inputs", response_model=str)
def resolve_inputs(metric_id: str) -> str:
    """解析评价指标输入"""
    return EvaluationMetricsRegistry.resolve_inputs(metric_id)
