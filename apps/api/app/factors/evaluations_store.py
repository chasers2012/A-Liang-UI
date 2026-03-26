from __future__ import annotations

import json
from pathlib import Path

from workspace import ensure_dir, workspace_path

from app.factors.evaluation_schemas import (
    FactorEvaluationsFile,
    FactorEvaluationSnapshot,
)

CONFIG_DIR = "config"
FACTOR_EVALUATIONS_FILENAME = "factor_evaluations.json"


def evaluations_file_path() -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, FACTOR_EVALUATIONS_FILENAME)


def load_evaluations_file() -> FactorEvaluationsFile:
    """
    Load workspace ``config/factor_evaluations.json``.
    Missing or whitespace-only file -> empty items.
    Raises ValueError on invalid JSON or schema validation failure.
    """
    path = evaluations_file_path()
    if not path.is_file():
        return FactorEvaluationsFile()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return FactorEvaluationsFile()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"factor_evaluations.json: invalid JSON ({e})") from e
    return FactorEvaluationsFile.model_validate(data)


def save_evaluations_file(data: FactorEvaluationsFile) -> None:
    path = evaluations_file_path()
    path.write_text(
        json.dumps(data.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


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
