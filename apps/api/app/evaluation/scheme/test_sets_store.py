from __future__ import annotations

from pathlib import Path

from app.persistence import registry_helpers
from app.persistence.registry_helpers import get_first_default_item, get_item_by_id
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

from .test_set_schemas import (
    EvaluationTestSetRecord,
    EvaluationTestSetsFile,
)

apply_default_uniqueness = registry_helpers.apply_default_uniqueness

REGISTRY_FILENAME = "evaluation_test_sets.json"


def registry_file_path() -> Path:
    return workspace_config_path(REGISTRY_FILENAME)


def load_file() -> EvaluationTestSetsFile:
    return load_workspace_config(
        REGISTRY_FILENAME,
        EvaluationTestSetsFile,
        default_factory=EvaluationTestSetsFile,
        non_dict_returns_default=True,
    )


def save_file(reg: EvaluationTestSetsFile) -> None:
    save_workspace_config(REGISTRY_FILENAME, reg)


def get_by_id(reg: EvaluationTestSetsFile, ts_id: str) -> EvaluationTestSetRecord | None:
    return get_item_by_id(reg.items, ts_id)


def get_default_test_set(reg: EvaluationTestSetsFile) -> EvaluationTestSetRecord | None:
    return get_first_default_item(reg.items)
