from __future__ import annotations

from app.datetime_utils import utc_now_iso
from app.evaluation.metrics.metric_package_manager import EvaluationMetricPackageManager

from .redistry import EvaluationMetricsRegistry
from .schemas import (
    EvaluationMetricCreate,
    EvaluationMetricDetailPublic,
    EvaluationMetricPatch,
    EvaluationMetricRecord,
    EvaluationMetricSummaryPublic,
    metric_source_validators,
)


def create_evaluation_metric(
    body: EvaluationMetricCreate,
    id_name: str | None = None,
) -> EvaluationMetricRecord:
    mid = EvaluationMetricsRegistry.generate_id(id_name)
    if id_name and EvaluationMetricsRegistry.get_item(mid) is not None:
        raise ValueError(f"Evaluation metric {id_name} already exists")
    now = utc_now_iso()
    rec = body.to_record(mid, now, EvaluationMetricPackageManager.get_source_path(mid))
    EvaluationMetricPackageManager.write_evaluation_metric_package(
        mid,
        body.source,
        validators=metric_source_validators,
    )
    EvaluationMetricsRegistry.add_item(rec)
    return rec


def load_metric(mid: str) -> EvaluationMetricSummaryPublic | None:
    rec = EvaluationMetricsRegistry.get_item(mid)
    if rec is None:
        return None

    return EvaluationMetricSummaryPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        inputs=[],
        outputs=[],
    )


def load_metric_detail(
    mid: str,
) -> EvaluationMetricDetailPublic | None:
    rec = EvaluationMetricsRegistry.get_item(mid)
    if rec is None:
        return None

    return EvaluationMetricDetailPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        inputs=[],
        outputs=[],
        source=EvaluationMetricsRegistry.read_source(rec),
    )


def list_metric_records() -> list[EvaluationMetricRecord]:
    return EvaluationMetricsRegistry.list_items()


def ensure_metrics_loaded() -> None:
    EvaluationMetricsRegistry.load()


def get_metric_record(mid: str) -> EvaluationMetricRecord | None:
    return EvaluationMetricsRegistry.get_item(mid)


def read_metric_source(rec: EvaluationMetricRecord) -> str:
    return EvaluationMetricsRegistry.read_source(rec)


def write_metric_source(rec: EvaluationMetricRecord, source: str) -> None:
    EvaluationMetricsRegistry.write_source(rec, source, validators=metric_source_validators)


def update_metric_record(metric_id: str, apply_fn) -> EvaluationMetricRecord | None:
    return EvaluationMetricsRegistry.update_item(metric_id, apply_fn)


def delete_evaluation_metric(metric_id: str) -> EvaluationMetricRecord | None:
    rec = EvaluationMetricsRegistry.get_item(metric_id)
    if rec is None:
        return None
    EvaluationMetricPackageManager.delete_evaluation_metric_package(metric_id)
    return EvaluationMetricsRegistry.delete_item(metric_id)


def resolve_metric_inputs(metric_id: str) -> str:
    return EvaluationMetricsRegistry.resolve_inputs(metric_id)


def apply_metric_patch(rec: EvaluationMetricRecord, patch: EvaluationMetricPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        rec.name = data["name"]
    if "description" in data:
        rec.description = (data["description"] or "").strip()
