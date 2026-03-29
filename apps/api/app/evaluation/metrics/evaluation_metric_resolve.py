"""Resolve metric_id to EvaluationMetric class and workflow output metadata."""

from __future__ import annotations

from dataclasses import dataclass

from evaluate import EvaluationMetric

from .metric_loader import load_evaluation_metric_class
from .metrics_store import EvaluationMetricsRegistry


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
    rec = EvaluationMetricsRegistry.get_item(mid)
    if rec is None:
        raise ValueError(f"评价指标不存在: {mid}")
    src = EvaluationMetricsRegistry.read_source(rec)
    cls, _ = load_evaluation_metric_class(src)
    _sf = getattr(cls, "SNAPSHOT_FIELD", None)
    snapshot_field = _sf if _sf in ("mean_ic", "mean_return_spread") else None
    return ResolvedEvaluationMetric(
        metric_class=cls,
        primary_output_socket=_primary_output_from_class(cls),
        snapshot_field=snapshot_field,
    )


def try_resolve_evaluation_metric(metric_id: str) -> ResolvedEvaluationMetric | None:
    try:
        return resolve_evaluation_metric(metric_id)
    except ValueError:
        return None
