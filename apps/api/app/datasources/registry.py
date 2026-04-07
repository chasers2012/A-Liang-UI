from __future__ import annotations

from app.datasources.schemas import DataSourceRecord, RegistryFile
from app.persistence.workspace_registry import WorkspaceItemsRegistry

REGISTRY_FILENAME = "datasources/registry.json"


class DataSourceItemsRegistry(WorkspaceItemsRegistry[DataSourceRecord, RegistryFile]):
    filename = REGISTRY_FILENAME
    file_model = RegistryFile
