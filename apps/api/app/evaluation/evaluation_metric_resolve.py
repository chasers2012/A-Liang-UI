"""Resolve metric_id to EvaluationMetric class and workflow output metadata."""

from __future__ import annotations

from dataclasses import dataclass

from evaluate import EvaluationMetric

from app.evaluation.builtin_metric_registry import (
    BUILTIN_METRICS,
    is_builtin_metric_id,
)
from app.evaluation.metric_loader import load_evaluation_metric_class
from app.evaluation.metrics_store import get_by_id as metric_get_by_id
from app.evaluation.metrics_store import load_registry as load_metrics_registry
from app.evaluation.metrics_store import read_source as read_metric_source


@dataclass(frozen=True)
class ResolvedEvaluationMetric:
    metric_class: type[EvaluationMetric]
    primary_output_socket: str
    snapshot_field: str | None


def _primary_output_from_class(cls: type[EvaluationMetric]) -> str:
    raw = getattr(cls, "OUTPUT_SOCKETS", None) or []
    if raw and isinstance(raw, (list, tuple)) and len(raw) > 0:
        first = raw[0]
        if isinstance(first, dict) and first.get("name"):
            return str(first["name"])
    return "out"


def resolve_evaluation_metric(metric_id: str) -> ResolvedEvaluationMetric:
    mid = (metric_id or "").strip()
    if not mid:
        raise ValueError("metric_id 不能为空")
    if is_builtin_metric_id(mid):
        e = BUILTIN_METRICS[mid]
        return ResolvedEvaluationMetric(
            metric_class=e.metric_class,
            primary_output_socket=e.primary_output_socket,
            snapshot_field=e.snapshot_field,
        )
    reg = load_metrics_registry()
    rec = metric_get_by_id(reg, mid)
    if rec is None:
        raise ValueError(f"评价指标不存在: {mid}")
    src = read_metric_source(rec)
    cls, _ = load_evaluation_metric_class(src)
    return ResolvedEvaluationMetric(
        metric_class=cls,
        primary_output_socket=_primary_output_from_class(cls),
        snapshot_field=None,
    )


def try_resolve_evaluation_metric(metric_id: str) -> ResolvedEvaluationMetric | None:
    try:
        return resolve_evaluation_metric(metric_id)
    except ValueError:
        return None
