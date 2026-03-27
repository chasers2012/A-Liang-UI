from __future__ import annotations

from pathlib import Path

from app.evaluation.profile_schemas import EvaluationProfileRecord, EvaluationProfilesFile
from app.persistence import registry_helpers
from app.persistence.registry_helpers import get_first_default_item, get_item_by_id
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

apply_default_uniqueness = registry_helpers.apply_default_uniqueness

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
    return get_item_by_id(reg.items, pid)


def get_default_profile(reg: EvaluationProfilesFile) -> EvaluationProfileRecord | None:
    return get_first_default_item(reg.items)
