from __future__ import annotations

import shutil
from collections.abc import Callable

from custom_code import SourceFiles
from evaluate import is_valid_evaluation_metric_class
from evaluate.evaluation_metric import EvaluationMetric
from workspace import workspace_path

from app.evaluation.metrics.constants import (
    USER_METRIC_WORKFLOW_ROOT,
)


class EvaluationMetricPackageManager:
    """
    User evaluation metric "package management" + workflow-type -> metric-id mapping.

    Encapsulates:
    - scaffold user metric python package under `workflow_nodes/evaluation/`
    - load/validate user metric class source
    - resolve metric ids from workflow node type FQN
    """

    @staticmethod
    def get_package_dir(metric_id: str) -> str:
        return f"em_{metric_id.replace('-', '_')}"

    @staticmethod
    def get_source_path(metric_id: str) -> str:
        return (
            f"{USER_METRIC_WORKFLOW_ROOT}/"
            f"{EvaluationMetricPackageManager.get_package_dir(metric_id)}/metric_node.py"
        )

    @staticmethod
    def write_evaluation_metric_package(
        metric_id: str,
        source: str,
        *,
        validators: list[Callable[[str], None]] | None = None,
    ) -> None:
        """Create package dir, `metric_node.py`."""
        pkg_dir = EvaluationMetricPackageManager.get_package_dir(metric_id)
        source_path = EvaluationMetricPackageManager.get_source_path(metric_id)

        pkg_root = workspace_path(
            "workflow_nodes",
            "evaluation",
            pkg_dir,
        )
        pkg_root.mkdir(parents=True, exist_ok=True)
        SourceFiles.write_source_text(source_path, source, validators=validators)

    @staticmethod
    def delete_evaluation_metric_package(metric_id: str) -> None:
        pkg_dir = EvaluationMetricPackageManager.get_package_dir(metric_id)
        pkg_root = workspace_path("workflow_nodes", "evaluation", pkg_dir)
        if pkg_root.is_dir():
            shutil.rmtree(pkg_root, ignore_errors=True)

    @staticmethod
    def is_valid_evaluation_metric_class(source: str) -> tuple[type[EvaluationMetric], str]:
        return is_valid_evaluation_metric_class(source)
