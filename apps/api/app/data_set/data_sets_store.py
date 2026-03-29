from __future__ import annotations

from app.persistence.workspace_registry import WorkspaceItemsRegistry

from .data_set_schemas import DataSetRecord, DataSetsFile

REGISTRY_FILENAME = "data_sets/registry.json"


class DataSetsStore(WorkspaceItemsRegistry[DataSetRecord, DataSetsFile]):
    """Workspace persistence for the data set registry."""

    filename = REGISTRY_FILENAME
    file_model = DataSetsFile

    @classmethod
    def load_workspace_kwargs(cls) -> dict:
        return {"non_dict_returns_default": True}
