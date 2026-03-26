from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from workspace import ensure_dir, get_workspace_root, workspace_path

from app.factors.schemas import FACTORS_DIR, FactorRegistryFile, FactorRecord

CONFIG_DIR = "config"
FACTORS_REGISTRY_FILENAME = "factors.json"


def registry_file_path() -> Path:
    ensure_dir(CONFIG_DIR)
    return workspace_path(CONFIG_DIR, FACTORS_REGISTRY_FILENAME)


def factors_dir_path() -> Path:
    return ensure_dir(FACTORS_DIR)


def resolve_source_path(source_path: str) -> Path:
    """Resolve ``source_path`` (relative to workspace root)."""
    p = Path(source_path)
    if p.is_absolute():
        return p.resolve()
    return (get_workspace_root() / p).resolve()


def load_registry() -> FactorRegistryFile:
    path = registry_file_path()
    if not path.is_file():
        return FactorRegistryFile()
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return FactorRegistryFile()
    data = json.loads(raw)
    return FactorRegistryFile.model_validate(data)


def save_registry(reg: FactorRegistryFile) -> None:
    path = registry_file_path()
    path.write_text(
        json.dumps(reg.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def get_by_id(reg: FactorRegistryFile, factor_id: str) -> Optional[FactorRecord]:
    for item in reg.items:
        if item.id == factor_id:
            return item
    return None


def read_source(rec: FactorRecord) -> str:
    path = resolve_source_path(rec.source_path)
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def write_source(rec: FactorRecord, source: str) -> None:
    factors_dir_path()
    path = resolve_source_path(rec.source_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(source, encoding="utf-8", newline="\n")


def delete_source_file(rec: FactorRecord) -> None:
    path = resolve_source_path(rec.source_path)
    try:
        if path.is_file():
            path.unlink()
    except OSError:
        pass
