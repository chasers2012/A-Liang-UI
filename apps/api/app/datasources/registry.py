from __future__ import annotations

from pathlib import Path

from workspace import get_workspace_root

from app.datasources.schemas import DataSourceRecord, RegistryFile
from app.persistence.workspace_registry import WorkspaceItemsRegistry

REGISTRY_FILENAME = "datasources.json"


class DataSourceItemsRegistry(WorkspaceItemsRegistry[DataSourceRecord, RegistryFile]):
    filename = REGISTRY_FILENAME
    file_model = RegistryFile


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()
