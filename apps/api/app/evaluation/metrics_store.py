from __future__ import annotations

from pathlib import Path

from workspace import ensure_dir

from app.evaluation.metric_schemas import (
    EVALUATION_METRICS_DIR,
    EvaluationMetricRecord,
    EvaluationMetricsRegistryFile,
)
from app.persistence.registry_helpers import get_item_by_id
from app.persistence.source_files import (
    delete_source_text_file,
    read_source_text,
    write_source_text,
)
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

REGISTRY_FILENAME = "evaluation_metrics.json"


def registry_file_path() -> Path:
    return workspace_config_path(REGISTRY_FILENAME)


def metrics_dir_path() -> Path:
    return ensure_dir(EVALUATION_METRICS_DIR)


def load_registry() -> EvaluationMetricsRegistryFile:
    reg = load_workspace_config(
        REGISTRY_FILENAME,
        EvaluationMetricsRegistryFile,
        default_factory=EvaluationMetricsRegistryFile,
    )
    from app.evaluation.builtin_metrics_seed import ensure_builtin_metrics_seeded

    if ensure_builtin_metrics_seeded(reg):
        save_registry(reg)
    return reg


def save_registry(reg: EvaluationMetricsRegistryFile) -> None:
    save_workspace_config(REGISTRY_FILENAME, reg)


def get_by_id(reg: EvaluationMetricsRegistryFile, metric_id: str) -> EvaluationMetricRecord | None:
    return get_item_by_id(reg.items, metric_id)


def read_source(rec: EvaluationMetricRecord) -> str:
    return read_source_text(rec.source_path)


def write_source(rec: EvaluationMetricRecord, source: str) -> None:
    metrics_dir_path()
    write_source_text(rec.source_path, source)


def delete_source_file(rec: EvaluationMetricRecord) -> None:
    delete_source_text_file(rec.source_path)
