from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.datetime_utils import utc_now_iso
from app.evaluation.metrics.constants import DEFAULT_METRIC_SOURCE
from app.evaluation.metrics.controller import (
    apply_metric_patch,
    get_metric_record,
    list_metric_records,
    load_metric,
    load_metric_detail,
    resolve_metric_inputs,
    update_metric_record,
    write_metric_source,
)
from app.evaluation.metrics.controller import (
    create_evaluation_metric as create_metric_record,
)
from app.evaluation.metrics.controller import (
    delete_evaluation_metric as delete_evaluation_metric_controller,
)
from app.evaluation.metrics.schemas import (
    EvaluationMetricCreate,
    EvaluationMetricDetailPublic,
    EvaluationMetricPatch,
    EvaluationMetricSummaryPublic,
)

router = APIRouter(prefix="/evaluation-metrics", tags=["evaluation-metrics"])


@router.get("", response_model=list[EvaluationMetricSummaryPublic])
def list_evaluation_metrics() -> list[EvaluationMetricSummaryPublic]:
    """获取评价指标列表"""
    return [x for i in list_metric_records() if (x := load_metric(i.id)) is not None]


@router.get("/template", response_model=str)
def get_evaluation_metric_template() -> str:
    """获取评价指标模板"""
    return DEFAULT_METRIC_SOURCE


@router.post("", response_model=EvaluationMetricDetailPublic)
def create_evaluation_metric(body: EvaluationMetricCreate) -> EvaluationMetricDetailPublic:
    """创建评价指标"""

    try:
        rec = create_metric_record(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    detail = load_metric(rec.id)
    if detail is None:
        raise HTTPException(status_code=500, detail="评价指标创建后加载失败")
    return detail


@router.get("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def get_evaluation_metric(metric_id: str) -> EvaluationMetricDetailPublic:
    """获取评价指标详情"""
    detail = load_metric_detail(metric_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    return detail


@router.patch("/{metric_id}", response_model=EvaluationMetricDetailPublic)
def patch_evaluation_metric(
    metric_id: str, body: EvaluationMetricPatch
) -> EvaluationMetricDetailPublic:
    """修改评价指标"""
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec) -> None:
        apply_metric_patch(rec, body)
        if "workflow_parameters" in unset and body.workflow_parameters is not None:
            rec.workflow_parameters = list(body.workflow_parameters)
        if "source" in unset and body.source is not None:
            try:
                write_metric_source(rec, body.source)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        rec.updated_at = utc_now_iso()

    rec = update_metric_record(metric_id, _apply)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    loaded = load_metric(rec.id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    return loaded


@router.delete("/{metric_id}", status_code=204)
def delete_evaluation_metric(metric_id: str) -> None:
    """删除评价指标"""
    if get_metric_record(metric_id) is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")
    if delete_evaluation_metric_controller(metric_id) is None:
        raise HTTPException(status_code=404, detail="评价指标不存在")


@router.get("/{metric_id}/inputs", response_model=str)
def resolve_inputs(metric_id: str) -> str:
    """解析评价指标输入"""
    return resolve_metric_inputs(metric_id)
