from __future__ import annotations

from app.persistence.workspace_registry import WorkspaceItemsRegistry
from app.workspace_config import workspace_config_path

from .data_set_schemas import DataSetRecord, DataSetsFile

REGISTRY_FILENAME = "data_sets.json"
_LEGACY_EVALUATION_DATA_SETS = "evaluation_data_sets.json"
_LEGACY_EVALUATION_TEST_SETS = "evaluation_test_sets.json"


class DataSetsStore(WorkspaceItemsRegistry[DataSetRecord, DataSetsFile]):
    """Workspace persistence for the data set registry (``data_sets.json``)."""

    filename = REGISTRY_FILENAME
    file_model = DataSetsFile

    @classmethod
    def load_filename(cls) -> str:
        if workspace_config_path(REGISTRY_FILENAME).is_file():
            return REGISTRY_FILENAME
        if workspace_config_path(_LEGACY_EVALUATION_DATA_SETS).is_file():
            return _LEGACY_EVALUATION_DATA_SETS
        if workspace_config_path(_LEGACY_EVALUATION_TEST_SETS).is_file():
            return _LEGACY_EVALUATION_TEST_SETS
        return REGISTRY_FILENAME

    @classmethod
    def load_workspace_kwargs(cls) -> dict:
        return {"non_dict_returns_default": True}
