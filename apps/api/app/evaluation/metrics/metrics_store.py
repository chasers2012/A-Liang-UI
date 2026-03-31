from __future__ import annotations

from pathlib import Path

from custom_code import SourceFiles
from workspace import ensure_dir

from app.datetime_utils import utc_now_iso
from app.evaluation.metrics.constants import REGISTRY_FILENAME, USER_METRIC_WORKFLOW_ROOT
from app.evaluation.metrics.metric_package_manager import EvaluationMetricPackageManager
from app.persistence.workspace_registry import WorkspaceItemsRegistry

from .metric_schemas import (
    EvaluationMetricCreate,
    EvaluationMetricRecord,
    EvaluationMetricsRegistryFile,
    metric_source_validators,
)


class EvaluationMetricsRegistry(
    WorkspaceItemsRegistry[EvaluationMetricRecord, EvaluationMetricsRegistryFile]
):
    filename = REGISTRY_FILENAME
    file_model = EvaluationMetricsRegistryFile

    @classmethod
    def load(cls) -> EvaluationMetricsRegistryFile:
        return super().load()

    @staticmethod
    def metrics_dir_path() -> Path:
        return ensure_dir(USER_METRIC_WORKFLOW_ROOT)

    @staticmethod
    def read_source(rec: EvaluationMetricRecord) -> str:
        return SourceFiles.read_source_text(rec.source_path)

    @classmethod
    def write_source(
        cls,
        rec: EvaluationMetricRecord,
        source: str,
        validators=None,
    ) -> None:
        cls.metrics_dir_path()
        SourceFiles.write_source_text(rec.source_path, source, validators=validators)

    @staticmethod
    def delete_source_file(rec: EvaluationMetricRecord) -> None:
        SourceFiles.delete_source_text_file(rec.source_path)

    @staticmethod
    def create_evaluation_metric(
        body: EvaluationMetricCreate, id_name: str | None = None
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
