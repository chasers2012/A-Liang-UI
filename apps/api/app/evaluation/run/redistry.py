from __future__ import annotations

from pathlib import Path
from typing import Any

from app.evaluation.run.schemas import (
    FactorEvaluationRecord,
    FactorEvaluationsFile,
)
from app.persistence.workspace_registry import WorkspaceJsonStore

FACTOR_EVALUATIONS_FILENAME = "factors/data/evaluations.json"


class FactorEvaluationsStore(WorkspaceJsonStore[FactorEvaluationsFile]):
    """Workspace ``factors/data/evaluations.json`` (factor_id -> latest evaluation)."""

    filename = FACTOR_EVALUATIONS_FILENAME
    file_model = FactorEvaluationsFile

    @classmethod
    def load_workspace_kwargs(cls) -> dict[str, Any]:
        return {"json_error_label": "factor_evaluations.json"}

    @classmethod
    def delete_for_factor(cls, factor_id: str) -> None:
        data = cls.load()
        if factor_id not in data.items:
            return
        del data.items[factor_id]
        cls.save(data)

    @classmethod
    def upsert_for_factor(cls, factor_id: str, rec: FactorEvaluationRecord) -> None:
        data = cls.load()
        data.items[factor_id] = rec
        cls.save(data)


def evaluations_file_path() -> Path:
    return FactorEvaluationsStore.path()


def load_evaluations_file() -> FactorEvaluationsFile:
    """
    Load workspace ``factors/data/evaluations.json``.
    Missing or whitespace-only file -> empty items.
    Raises ValueError on invalid JSON or schema validation failure.
    """
    return FactorEvaluationsStore.load()


def save_evaluations_file(data: FactorEvaluationsFile) -> None:
    FactorEvaluationsStore.save(data)


def delete_evaluation_for_factor(factor_id: str) -> None:
    FactorEvaluationsStore.delete_for_factor(factor_id)


def upsert_evaluation_for_factor(factor_id: str, rec: FactorEvaluationRecord) -> None:
    FactorEvaluationsStore.upsert_for_factor(factor_id, rec)
