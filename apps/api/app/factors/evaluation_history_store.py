from __future__ import annotations

import json
from pathlib import Path

from workspace import ensure_dir, workspace_path

from app.factors.evaluation_history_schemas import (
    FactorEvaluationHistoryEntry,
    FactorEvaluationHistoryFile,
)
from app.factors.evaluation_schemas import FactorEvaluationSnapshot
from app.factors.schemas import new_factor_id

CONFIG_DIR = "config"
FACTOR_EVALUATION_HISTORY_FILENAME = "factor_evaluation_history.json"


def history_file_path() -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, FACTOR_EVALUATION_HISTORY_FILENAME)


def load_evaluation_history_file() -> FactorEvaluationHistoryFile:
    path = history_file_path()
    if not path.is_file():
        return FactorEvaluationHistoryFile()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return FactorEvaluationHistoryFile()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"factor_evaluation_history.json: invalid JSON ({e})") from e
    return FactorEvaluationHistoryFile.model_validate(data)


def save_evaluation_history_file(data: FactorEvaluationHistoryFile) -> None:
    path = history_file_path()
    path.write_text(
        json.dumps(data.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def append_history_entry(
    factor_id: str,
    entry: FactorEvaluationHistoryEntry,
) -> None:
    file = load_evaluation_history_file()
    lst = list(file.items.get(factor_id, []))
    lst.append(entry)
    file.items[factor_id] = lst
    save_evaluation_history_file(file)


def entry_from_latest_evaluation(
    snap: FactorEvaluationSnapshot,
    *,
    linked_snapshot_id: str | None,
) -> FactorEvaluationHistoryEntry:
    return FactorEvaluationHistoryEntry(
        id=new_factor_id(),
        linked_snapshot_id=linked_snapshot_id,
        evaluated_at=snap.evaluated_at,
        window=snap.window,
        stock_count=snap.stock_count,
        mean_ic=dict(snap.mean_ic),
        mean_return_spread=dict(snap.mean_return_spread),
        error=snap.error,
    )


def list_history_for_factor(factor_id: str) -> list[FactorEvaluationHistoryEntry]:
    file = load_evaluation_history_file()
    return list(file.items.get(factor_id, []))


def delete_history_for_factor(factor_id: str) -> None:
    file = load_evaluation_history_file()
    if factor_id not in file.items:
        return
    del file.items[factor_id]
    save_evaluation_history_file(file)
