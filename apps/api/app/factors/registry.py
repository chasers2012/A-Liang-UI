from __future__ import annotations

from pathlib import Path

from custom_code import SourceFiles
from workspace import ensure_dir

from app.factors.schemas import FACTORS_DIR, FactorRecord, FactorRegistryFile
from app.persistence.workspace_registry import WorkspaceItemsRegistry

resolve_source_path = SourceFiles.resolve_source_path

FACTORS_REGISTRY_FILENAME = "factors/registry.json"


class FactorItemsRegistry(WorkspaceItemsRegistry[FactorRecord, FactorRegistryFile]):
    filename = FACTORS_REGISTRY_FILENAME
    file_model = FactorRegistryFile


def factors_dir_path() -> Path:
    return ensure_dir(FACTORS_DIR)


def read_source(rec: FactorRecord) -> str:
    return SourceFiles.read_source_text(rec.source_path)


def write_source(rec: FactorRecord, source: str, validators=None) -> None:
    factors_dir_path()
    SourceFiles.write_source_text(rec.source_path, source, validators=validators)


def delete_source_file(rec: FactorRecord) -> None:
    SourceFiles.delete_source_text_file(rec.source_path)
