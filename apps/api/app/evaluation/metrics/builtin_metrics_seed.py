"""Idempotent seeding of built-in metrics into workspace registry and source files."""

from __future__ import annotations

from importlib import resources

from custom_code import SourceFiles

from .builtin_metric_registry import BUILTIN_SEED_METAS
from .metric_schemas import (
    EvaluationMetricRecord,
    MetricVisualizationSpec,
    source_relative_path,
    utc_now_iso,
)


def _template_text(filename: str) -> str:
    root = resources.files("app.evaluation.metrics.builtin_metric_templates")
    return root.joinpath(filename).read_text(encoding="utf-8")


def _source_missing_or_empty(source_path: str) -> bool:
    p = SourceFiles.resolve_source_path(source_path)
    if not p.is_file():
        return True
    return SourceFiles.read_source_text(source_path).strip() == ""


def ensure_builtin_metrics_seeded(reg) -> bool:
    """Mutate *reg* in place; return whether the registry JSON should be saved."""
    from .metrics_store import EvaluationMetricsRegistry

    changed = False
    now = utc_now_iso()
    for meta in BUILTIN_SEED_METAS:
        rec = EvaluationMetricsRegistry.get_by_id(reg, meta.metric_id)
        template = _template_text(meta.template_file)
        vis = (
            MetricVisualizationSpec.model_validate(meta.visualization)
            if meta.visualization
            else None
        )
        if rec is None:
            rec = EvaluationMetricRecord(
                id=meta.metric_id,
                name=meta.label,
                description=meta.description,
                source_path=source_relative_path(meta.metric_id),
                created_at=now,
                updated_at=now,
                visualization=vis,
                builtin=True,
            )
            reg.items.append(rec)
            EvaluationMetricsRegistry.write_source(rec, template)
            changed = True
            continue
        if not rec.builtin:
            rec.builtin = True
            changed = True
        if rec.visualization is None and vis is not None:
            rec.visualization = vis
            changed = True
        if _source_missing_or_empty(rec.source_path):
            EvaluationMetricsRegistry.write_source(rec, template)
            changed = True
    return changed
