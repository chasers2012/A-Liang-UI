from __future__ import annotations

from pathlib import Path

from custom_code import SourceFiles
from workspace import ensure_dir

from app.persistence.workspace_registry import WorkspaceItemsRegistry

from .metric_schemas import (
    EVALUATION_METRICS_DIR,
    EvaluationMetricRecord,
    EvaluationMetricsRegistryFile,
)

REGISTRY_FILENAME = "evaluation/metrics/registry.json"


class EvaluationMetricsRegistry(
    WorkspaceItemsRegistry[EvaluationMetricRecord, EvaluationMetricsRegistryFile]
):
    filename = REGISTRY_FILENAME
    file_model = EvaluationMetricsRegistryFile

    @classmethod
    def load(cls) -> EvaluationMetricsRegistryFile:
        reg = super().load()
        from .builtin_metrics_seed import ensure_builtin_metrics_seeded

        if ensure_builtin_metrics_seeded(reg):
            cls.save(reg)
        return reg

    @staticmethod
    def metrics_dir_path() -> Path:
        return ensure_dir(EVALUATION_METRICS_DIR)

    @staticmethod
    def read_source(rec: EvaluationMetricRecord) -> str:
        return SourceFiles.read_source_text(rec.source_path)

    @classmethod
    def write_source(cls, rec: EvaluationMetricRecord, source: str, validators=None) -> None:
        cls.metrics_dir_path()
        SourceFiles.write_source_text(rec.source_path, source, validators=validators)

    @staticmethod
    def delete_source_file(rec: EvaluationMetricRecord) -> None:
        SourceFiles.delete_source_text_file(rec.source_path)
