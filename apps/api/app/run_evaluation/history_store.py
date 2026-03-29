from __future__ import annotations

from pathlib import Path

from app.factors.schemas import new_factor_id
from app.run_evaluation.history_schemas import (
    FactorEvaluationHistoryEntry,
    FactorEvaluationHistoryFile,
)
from app.run_evaluation.schemas import FactorEvaluationSnapshot
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

FACTOR_EVALUATION_HISTORY_FILENAME = "factors/data/evaluation_history.json"


def history_file_path() -> Path:
    return workspace_config_path(FACTOR_EVALUATION_HISTORY_FILENAME)


def load_evaluation_history_file() -> FactorEvaluationHistoryFile:
    return load_workspace_config(
        FACTOR_EVALUATION_HISTORY_FILENAME,
        FactorEvaluationHistoryFile,
        default_factory=FactorEvaluationHistoryFile,
        json_error_label="factor_evaluation_history.json",
    )


def save_evaluation_history_file(data: FactorEvaluationHistoryFile) -> None:
    save_workspace_config(FACTOR_EVALUATION_HISTORY_FILENAME, data)


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
