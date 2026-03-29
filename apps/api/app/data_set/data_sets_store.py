from __future__ import annotations

from pathlib import Path

from app.persistence import registry_helpers
from app.persistence.registry_helpers import get_first_default_item, get_item_by_id
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

from .data_set_schemas import (
    DataSetRecord,
    DataSetsFile,
)

apply_default_uniqueness = registry_helpers.apply_default_uniqueness

REGISTRY_FILENAME = "data_sets.json"
_LEGACY_EVALUATION_DATA_SETS = "evaluation_data_sets.json"
_LEGACY_EVALUATION_TEST_SETS = "evaluation_test_sets.json"


def registry_file_path() -> Path:
    return workspace_config_path(REGISTRY_FILENAME)


def _load_registry_filename() -> str:
    if workspace_config_path(REGISTRY_FILENAME).is_file():
        return REGISTRY_FILENAME
    if workspace_config_path(_LEGACY_EVALUATION_DATA_SETS).is_file():
        return _LEGACY_EVALUATION_DATA_SETS
    if workspace_config_path(_LEGACY_EVALUATION_TEST_SETS).is_file():
        return _LEGACY_EVALUATION_TEST_SETS
    return REGISTRY_FILENAME


def load_file() -> DataSetsFile:
    return load_workspace_config(
        _load_registry_filename(),
        DataSetsFile,
        default_factory=DataSetsFile,
        non_dict_returns_default=True,
    )


def save_file(reg: DataSetsFile) -> None:
    save_workspace_config(REGISTRY_FILENAME, reg)


def get_by_id(reg: DataSetsFile, data_set_id: str) -> DataSetRecord | None:
    return get_item_by_id(reg.items, data_set_id)


def get_default_data_set(reg: DataSetsFile) -> DataSetRecord | None:
    return get_first_default_item(reg.items)
