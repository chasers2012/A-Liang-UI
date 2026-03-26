from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from workspace import ensure_dir, get_workspace_root, workspace_path

from app.evaluation_metric_schemas import (
    EVALUATION_METRICS_DIR,
    EvaluationMetricRecord,
    EvaluationMetricsRegistryFile,
)

CONFIG_DIR = "config"
REGISTRY_FILENAME = "evaluation_metrics.json"


def registry_file_path() -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, REGISTRY_FILENAME)


def metrics_dir_path() -> Path:
    return ensure_dir(EVALUATION_METRICS_DIR)


def resolve_source_path(source_path: str) -> Path:
    p = Path(source_path)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


def load_registry() -> EvaluationMetricsRegistryFile:
    path = registry_file_path()
    if not path.is_file():
        return EvaluationMetricsRegistryFile()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return EvaluationMetricsRegistryFile()
    return EvaluationMetricsRegistryFile.model_validate(json.loads(raw))


def save_registry(reg: EvaluationMetricsRegistryFile) -> None:
    path = registry_file_path()
    path.write_text(
        json.dumps(reg.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


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
