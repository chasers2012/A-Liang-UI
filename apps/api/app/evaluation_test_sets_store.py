from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from workspace import ensure_dir, workspace_path

from app.evaluation_test_set_schemas import (
    EvaluationTestSetRecord,
    EvaluationTestSetsFile,
)

CONFIG_DIR = "config"
REGISTRY_FILENAME = "evaluation_test_sets.json"


def registry_file_path() -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, REGISTRY_FILENAME)


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
    path = registry_file_path()
    if not path.is_file():
        return EvaluationTestSetsFile()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return EvaluationTestSetsFile()
    data = json.loads(raw)
    if not isinstance(data, dict):
        return EvaluationTestSetsFile()
    data = _migrate_raw_to_v2(data)
    return EvaluationTestSetsFile.model_validate(data)


def save_file(reg: EvaluationTestSetsFile) -> None:
    path = registry_file_path()
    path.write_text(
        json.dumps(reg.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def get_by_id(reg: EvaluationTestSetsFile, ts_id: str) -> Optional[EvaluationTestSetRecord]:
    for item in reg.items:
        if item.id == ts_id:
            return item
    return None


def apply_default_uniqueness(items: list[EvaluationTestSetRecord]) -> None:
    default_ids = [i.id for i in items if i.is_default]
    if len(default_ids) <= 1:
        return
    keep = default_ids[-1]
    for i in items:
        if i.id != keep:
            i.is_default = False


def get_default_test_set(reg: EvaluationTestSetsFile) -> Optional[EvaluationTestSetRecord]:
    for i in reg.items:
        if i.is_default:
            return i
    return None
