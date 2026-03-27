from __future__ import annotations

from pathlib import Path

from workspace import get_workspace_root

from app.datasources.schemas import DataSourceRecord, RegistryFile
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

REGISTRY_FILENAME = "datasources.json"


def registry_file_path() -> Path:
    return workspace_config_path(REGISTRY_FILENAME)


def load_registry() -> RegistryFile:
    return load_workspace_config(
        REGISTRY_FILENAME,
        RegistryFile,
        default_factory=RegistryFile,
    )


def save_registry(reg: RegistryFile) -> None:
    save_workspace_config(REGISTRY_FILENAME, reg)


def get_by_id(reg: RegistryFile, ds_id: str) -> DataSourceRecord | None:
    for item in reg.items:
        if item.id == ds_id:
            return item
    return None


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()
