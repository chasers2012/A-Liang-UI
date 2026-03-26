from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from workspace import ensure_dir, workspace_path

from app.evaluation.profile_schemas import EvaluationProfileRecord, EvaluationProfilesFile

CONFIG_DIR = "config"
REGISTRY_FILENAME = "evaluation_profiles.json"


def registry_file_path() -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, REGISTRY_FILENAME)


def load_file() -> EvaluationProfilesFile:
    path = registry_file_path()
    if not path.is_file():
        return EvaluationProfilesFile()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return EvaluationProfilesFile()
    return EvaluationProfilesFile.model_validate(json.loads(raw))


def save_file(reg: EvaluationProfilesFile) -> None:
    path = registry_file_path()
    path.write_text(
        json.dumps(reg.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def get_by_id(reg: EvaluationProfilesFile, pid: str) -> Optional[EvaluationProfileRecord]:
    for item in reg.items:
        if item.id == pid:
            return item
    return None


def apply_default_uniqueness(items: list[EvaluationProfileRecord]) -> None:
    default_ids = [i.id for i in items if i.is_default]
    if len(default_ids) <= 1:
        return
    keep = default_ids[-1]
    for i in items:
        if i.id != keep:
            i.is_default = False


def get_default_profile(reg: EvaluationProfilesFile) -> Optional[EvaluationProfileRecord]:
    for i in reg.items:
        if i.is_default:
            return i
    return None
