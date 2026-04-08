from __future__ import annotations

from pathlib import Path
from typing import Any

from app.evaluation.run.schemas import (
    EvaluationRunRecord,
    EvaluationRunsFile,
)
from app.persistence.workspace_registry import WorkspaceItemsRegistry

EVALUATION_RUNS_FILENAME = "evaluation/run/registry.json"


class EvaluationRunsStore(WorkspaceItemsRegistry[EvaluationRunRecord, EvaluationRunsFile]):
    """Workspace ``evaluation/run/registry.json`` (all runs history)."""

    filename = EVALUATION_RUNS_FILENAME
    file_model = EvaluationRunsFile

    @classmethod
    def load_workspace_kwargs(cls) -> dict[str, Any]:
        return {"json_error_label": "evaluation_run_registry.json"}

    @classmethod
    def load(cls) -> EvaluationRunsFile:
        return super().load()

    @classmethod
    def get_by_factor_id(cls, factor_id: str) -> EvaluationRunRecord | None:
        return cls.get_latest_by_factor_id(factor_id)

    @classmethod
    def list_by_factor_id(cls, factor_id: str) -> list[EvaluationRunRecord]:
        return [rec for rec in cls.list_items() if rec.factor_id == factor_id]

    @classmethod
    def get_latest_by_factor_id(cls, factor_id: str) -> EvaluationRunRecord | None:
        records = cls.list_by_factor_id(factor_id)
        if not records:
            return None
        return max(records, key=lambda rec: rec.end_at)

    @classmethod
    def append(cls, rec: EvaluationRunRecord) -> None:
        cls.add_item(rec)

    @classmethod
    def delete_by_id(cls, run_id: str) -> bool:
        return cls.delete_item(run_id) is not None

    @classmethod
    def delete_for_factor(cls, factor_id: str) -> None:
        records = cls.list_by_factor_id(factor_id)
        for rec in records:
            cls.delete_item(rec.id)


def evaluations_file_path() -> Path:
    return EvaluationRunsStore.path()


def load_evaluations_file() -> EvaluationRunsFile:
    """
    Load workspace ``evaluation/run/registry.json``.
    Missing or whitespace-only file -> empty items.
    Raises ValueError on invalid JSON or schema validation failure.
    """
    return EvaluationRunsStore.load()


def save_evaluations_file(data: EvaluationRunsFile) -> None:
    EvaluationRunsStore.save(data)


def delete_evaluation_run_for_factor(factor_id: str) -> None:
    EvaluationRunsStore.delete_for_factor(factor_id)


def delete_evaluation_run_by_id(run_id: str) -> bool:
    return EvaluationRunsStore.delete_by_id(run_id)


def upsert_evaluation_run(rec: EvaluationRunRecord) -> None:
    EvaluationRunsStore.append(rec)
