from __future__ import annotations

from pathlib import Path
from typing import Any

from app.persistence.workspace_registry import WorkspaceJsonStore
from app.run_evaluation.schemas import (
    FactorEvaluationsFile,
    FactorEvaluationSnapshot,
)

FACTOR_EVALUATIONS_FILENAME = "factor_evaluations.json"


class FactorEvaluationsStore(WorkspaceJsonStore[FactorEvaluationsFile]):
    """Workspace ``config/factor_evaluations.json`` (factor_id → latest snapshot)."""

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
    def upsert_for_factor(cls, factor_id: str, snap: FactorEvaluationSnapshot) -> None:
        data = cls.load()
        data.items[factor_id] = snap
        cls.save(data)


def evaluations_file_path() -> Path:
    return FactorEvaluationsStore.path()


def load_evaluations_file() -> FactorEvaluationsFile:
    """
    Load workspace ``config/factor_evaluations.json``.
    Missing or whitespace-only file -> empty items.
    Raises ValueError on invalid JSON or schema validation failure.
    """
    return FactorEvaluationsStore.load()


def save_evaluations_file(data: FactorEvaluationsFile) -> None:
    FactorEvaluationsStore.save(data)


def delete_evaluation_for_factor(factor_id: str) -> None:
    FactorEvaluationsStore.delete_for_factor(factor_id)


def upsert_evaluation_for_factor(factor_id: str, snap: FactorEvaluationSnapshot) -> None:
    FactorEvaluationsStore.upsert_for_factor(factor_id, snap)
