from __future__ import annotations

from pathlib import Path
from typing import Optional

from workspace import ensure_dir, get_workspace_root

from app.evaluation.metric_schemas import (
    EVALUATION_METRICS_DIR,
    EvaluationMetricRecord,
    EvaluationMetricsRegistryFile,
)
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

REGISTRY_FILENAME = "evaluation_metrics.json"


def registry_file_path() -> Path:
    return workspace_config_path(REGISTRY_FILENAME)


def metrics_dir_path() -> Path:
    return ensure_dir(EVALUATION_METRICS_DIR)


def resolve_source_path(source_path: str) -> Path:
    p = Path(source_path)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


def load_registry() -> EvaluationMetricsRegistryFile:
    return load_workspace_config(
        REGISTRY_FILENAME,
        EvaluationMetricsRegistryFile,
        default_factory=EvaluationMetricsRegistryFile,
    )


def save_registry(reg: EvaluationMetricsRegistryFile) -> None:
    save_workspace_config(REGISTRY_FILENAME, reg)


def get_by_id(
    reg: EvaluationMetricsRegistryFile, metric_id: str
) -> Optional[EvaluationMetricRecord]:
    for item in reg.items:
        if item.id == metric_id:
            return item
    return None


def read_source(rec: EvaluationMetricRecord) -> str:
    path = resolve_source_path(rec.source_path)
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def write_source(rec: EvaluationMetricRecord, source: str) -> None:
    metrics_dir_path()
    path = resolve_source_path(rec.source_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source, encoding="utf-8", newline="\n")


def delete_source_file(rec: EvaluationMetricRecord) -> None:
    path = resolve_source_path(rec.source_path)
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass
