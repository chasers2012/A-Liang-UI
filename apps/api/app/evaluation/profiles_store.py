from __future__ import annotations

from pathlib import Path

from app.evaluation.profile_schemas import EvaluationProfileRecord, EvaluationProfilesFile
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

REGISTRY_FILENAME = "evaluation_profiles.json"


def registry_file_path() -> Path:
    return workspace_config_path(REGISTRY_FILENAME)


def load_file() -> EvaluationProfilesFile:
    return load_workspace_config(
        REGISTRY_FILENAME,
        EvaluationProfilesFile,
        default_factory=EvaluationProfilesFile,
    )


def save_file(reg: EvaluationProfilesFile) -> None:
    save_workspace_config(
        REGISTRY_FILENAME,
        reg,
        model_dump_kwargs={"mode": "json"},
    )


def get_by_id(reg: EvaluationProfilesFile, pid: str) -> EvaluationProfileRecord | None:
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


def get_default_profile(reg: EvaluationProfilesFile) -> EvaluationProfileRecord | None:
    for i in reg.items:
        if i.is_default:
            return i
    return None
