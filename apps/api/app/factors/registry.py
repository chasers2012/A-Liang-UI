from __future__ import annotations

from pathlib import Path

from workspace import ensure_dir

from app.factors.schemas import FACTORS_DIR, FactorRecord, FactorRegistryFile
from app.persistence.source_files import WorkspaceSourceFiles
from app.persistence.workspace_registry import WorkspaceItemsRegistry

resolve_source_path = WorkspaceSourceFiles.resolve_source_path

FACTORS_REGISTRY_FILENAME = "factors.json"


class FactorItemsRegistry(WorkspaceItemsRegistry[FactorRecord, FactorRegistryFile]):
    filename = FACTORS_REGISTRY_FILENAME
    file_model = FactorRegistryFile


def factors_dir_path() -> Path:
    return ensure_dir(FACTORS_DIR)


def read_source(rec: FactorRecord) -> str:
    return WorkspaceSourceFiles.read_source_text(rec.source_path)


def write_source(rec: FactorRecord, source: str) -> None:
    factors_dir_path()
    WorkspaceSourceFiles.write_source_text(rec.source_path, source)


def delete_source_file(rec: FactorRecord) -> None:
    WorkspaceSourceFiles.delete_source_text_file(rec.source_path)
