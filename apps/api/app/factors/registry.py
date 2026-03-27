from __future__ import annotations

from pathlib import Path

from workspace import ensure_dir

from app.factors.schemas import FACTORS_DIR, FactorRecord, FactorRegistryFile
from app.persistence.registry_helpers import get_item_by_id
from app.persistence.source_files import (
    delete_source_text_file,
    read_source_text,
    write_source_text,
)
from app.workspace_config import load_workspace_config, save_workspace_config, workspace_config_path

FACTORS_REGISTRY_FILENAME = "factors.json"


def registry_file_path() -> Path:
    return workspace_config_path(FACTORS_REGISTRY_FILENAME)


def factors_dir_path() -> Path:
    return ensure_dir(FACTORS_DIR)


def load_registry() -> FactorRegistryFile:
    return load_workspace_config(
        FACTORS_REGISTRY_FILENAME,
        FactorRegistryFile,
        default_factory=FactorRegistryFile,
    )


def save_registry(reg: FactorRegistryFile) -> None:
    save_workspace_config(FACTORS_REGISTRY_FILENAME, reg)


def get_by_id(reg: FactorRegistryFile, factor_id: str) -> FactorRecord | None:
    return get_item_by_id(reg.items, factor_id)


def read_source(rec: FactorRecord) -> str:
    return read_source_text(rec.source_path)


def write_source(rec: FactorRecord, source: str) -> None:
    factors_dir_path()
    write_source_text(rec.source_path, source)


def delete_source_file(rec: FactorRecord) -> None:
    delete_source_text_file(rec.source_path)
