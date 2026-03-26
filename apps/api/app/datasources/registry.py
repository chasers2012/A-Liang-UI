from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from workspace import ensure_dir, get_workspace_root, workspace_path

from app.datasources.schemas import DataSourceRecord, RegistryFile

CONFIG_DIR = "config"
REGISTRY_FILENAME = "datasources.json"


def registry_file_path() -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, REGISTRY_FILENAME)


def load_registry() -> RegistryFile:
    path = registry_file_path()
    if not path.is_file():
        return RegistryFile()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return RegistryFile()
    data = json.loads(raw)
    return RegistryFile.model_validate(data)


def save_registry(reg: RegistryFile) -> None:
    path = registry_file_path()
    path.write_text(
        json.dumps(reg.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def get_by_id(reg: RegistryFile, ds_id: str) -> Optional[DataSourceRecord]:
    for item in reg.items:
        if item.id == ds_id:
            return item
    return None


def resolve_csv_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()
