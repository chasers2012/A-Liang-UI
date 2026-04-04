from __future__ import annotations

from app.datasources.registry import DataSourceItemsRegistry
from app.persistence.workspace_registry import WorkspaceItemsRegistry
from evaluate.data_set import DataSet, DataSourceBinding

from .data_set_schemas import DataSetRecord, DataSetsFile

REGISTRY_FILENAME = "data_sets/registry.json"


class DataSetsStore(WorkspaceItemsRegistry[DataSetRecord, DataSetsFile]):
    """Workspace persistence for the data set registry."""

    filename = REGISTRY_FILENAME
    file_model = DataSetsFile

    @classmethod
    def load_workspace_kwargs(cls) -> dict:
        return {"non_dict_returns_default": True}

    @classmethod
    def get_data_set(cls, id: str) -> DataSet | None:
        rec = cls.get_item(id)
        if rec is None:
            return None
        return DataSet(
            data_source_bindings=[
                DataSourceBinding(
                    datasource=DataSourceItemsRegistry.get_datasource(binding.datasource_id),
                    dependencies=binding.dependencies,
                    alias=binding.alias,
                )
                for binding in rec.datasource_bindings
            ]
        )
