from __future__ import annotations

from pathlib import Path

from app.evaluation.test_set_schemas import (
    EvaluationTestSetRecord,
    EvaluationTestSetsFile,
)
from app.persistence import registry_helpers
from app.persistence.registry_helpers import get_first_default_item, get_item_by_id
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

apply_default_uniqueness = registry_helpers.apply_default_uniqueness

REGISTRY_FILENAME = "evaluation_test_sets.json"


def registry_file_path() -> Path:
    return workspace_config_path(REGISTRY_FILENAME)


def _migrate_raw_to_v2(data: dict) -> dict:
    """v1 items used ``datasource_id``; v2 uses ``datasource_bindings``."""
    out = dict(data)
    ver = int(out.get("version", 1))
    items = out.get("items")
    if not isinstance(items, list):
        out["version"] = 2
        out["items"] = []
        return out
    new_items: list[dict] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        row = dict(it)
        if "datasource_bindings" not in row and row.get("datasource_id"):
            ds = str(row.pop("datasource_id")).strip()
            row["datasource_bindings"] = [
                {"datasource_id": ds, "dependencies": []},
            ]
        elif "datasource_bindings" not in row:
            row["datasource_bindings"] = []
        new_items.append(row)
    out["items"] = new_items
    out["version"] = 2
    if ver < 2:
        _ = ver  # migrated from older on-disk format
    return out


def load_file() -> EvaluationTestSetsFile:
    return load_workspace_config(
        REGISTRY_FILENAME,
        EvaluationTestSetsFile,
        default_factory=EvaluationTestSetsFile,
        migrate_raw=_migrate_raw_to_v2,
        non_dict_returns_default=True,
    )


def save_file(reg: EvaluationTestSetsFile) -> None:
    save_workspace_config(REGISTRY_FILENAME, reg)


def get_by_id(reg: EvaluationTestSetsFile, ts_id: str) -> EvaluationTestSetRecord | None:
    return get_item_by_id(reg.items, ts_id)


def get_default_test_set(reg: EvaluationTestSetsFile) -> EvaluationTestSetRecord | None:
    return get_first_default_item(reg.items)
