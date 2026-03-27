from __future__ import annotations

from pathlib import Path

from app.factors.evaluation_schemas import (
    FactorEvaluationsFile,
    FactorEvaluationSnapshot,
)
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

FACTOR_EVALUATIONS_FILENAME = "factor_evaluations.json"


def evaluations_file_path() -> Path:
    return workspace_config_path(FACTOR_EVALUATIONS_FILENAME)


def load_evaluations_file() -> FactorEvaluationsFile:
    """
    Load workspace ``config/factor_evaluations.json``.
    Missing or whitespace-only file -> empty items.
    Raises ValueError on invalid JSON or schema validation failure.
    """
    return load_workspace_config(
        FACTOR_EVALUATIONS_FILENAME,
        FactorEvaluationsFile,
        default_factory=FactorEvaluationsFile,
        json_error_label="factor_evaluations.json",
    )


def save_evaluations_file(data: FactorEvaluationsFile) -> None:
    save_workspace_config(FACTOR_EVALUATIONS_FILENAME, data)


def delete_evaluation_for_factor(factor_id: str) -> None:
    file = load_evaluations_file()
    if factor_id not in file.items:
        return
    del file.items[factor_id]
    save_evaluations_file(file)


def upsert_evaluation_for_factor(
    factor_id: str, snap: FactorEvaluationSnapshot
) -> None:
    file = load_evaluations_file()
    file.items[factor_id] = snap
    save_evaluations_file(file)
