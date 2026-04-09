from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

from custom_code import SourceFiles, validate_source_syntax
from factor import DataPreprocessorBase

from app.common.datetime_utils import utc_now_iso
from app.preprocessors.package_manager import PreprocessorPackageManager
from app.preprocessors.registry import PreprocessorsRegistry
from app.preprocessors.schemas import (
    PreprocessorCreate,
    PreprocessorDetailPublic,
    PreprocessorPatch,
    PreprocessorRecord,
    PreprocessorSummaryPublic,
)


def _resolve_source_path(source_path: str) -> Path:
    return SourceFiles.resolve_source_path(source_path)


def _load_preprocessor_from_file(
    preprocessor_id: str, source_path: str
) -> type[DataPreprocessorBase] | None:
    source_file = _resolve_source_path(source_path)
    if not source_file.is_file():
        return None

    safe_id = re.sub(r"\W+", "_", preprocessor_id)
    module_name = f"_quant_agent_user_preprocessor_{safe_id}"
    spec = importlib.util.spec_from_file_location(module_name, str(source_file))
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    candidates: list[type[DataPreprocessorBase]] = []
    for obj in module.__dict__.values():
        if (
            isinstance(obj, type)
            and issubclass(obj, DataPreprocessorBase)
            and obj is not DataPreprocessorBase
        ):
            candidates.append(obj)
    if not candidates:
        return None
    return candidates[0]


def ensure_preprocessor_source_is_valid(source: str) -> None:
    validate_source_syntax(source)
    # Quick structural check by executing via a temp file-like path isn't available here;
    # validation is enforced by trying to load after write in create/update.


def create_preprocessor(
    body: PreprocessorCreate, *, id_name: str | None = None
) -> PreprocessorRecord:
    pid = PreprocessorsRegistry.generate_id((id_name or "").strip() or None)
    if PreprocessorsRegistry.get_item(pid) is not None:
        raise ValueError(f"Preprocessor {pid} already exists")

    now = utc_now_iso()
    rec = body.to_record(pid, now)
    src = body.source or ""
    PreprocessorPackageManager.write_preprocessor_package(
        pid,
        src,
        validators=[validate_source_syntax],
    )

    # Validate loadable class
    cls = _load_preprocessor_from_file(pid, rec.source_path)
    if cls is None:
        raise ValueError("source 中未找到继承 DataPreprocessorBase 的预处理器类")

    # Derive name/description if provided on class
    rec.name = (
        getattr(cls, "name", rec.name) if isinstance(getattr(cls, "name", None), str) else rec.name
    )
    rec.description = (
        getattr(cls, "description", rec.description)
        if isinstance(getattr(cls, "description", None), str)
        else rec.description
    )

    PreprocessorsRegistry.add_item(rec)
    return rec


def list_preprocessor_records() -> list[PreprocessorRecord]:
    return PreprocessorsRegistry.list_items()


def get_preprocessor_record(pid: str) -> PreprocessorRecord | None:
    return PreprocessorsRegistry.get_item(pid)


def read_preprocessor_source(rec: PreprocessorRecord) -> str:
    return SourceFiles.read_source_text(rec.source_path)


def load_preprocessor(pid: str) -> PreprocessorSummaryPublic | None:
    rec = PreprocessorsRegistry.get_item(pid)
    if rec is None:
        return None
    return PreprocessorSummaryPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def load_preprocessor_detail(pid: str) -> PreprocessorDetailPublic | None:
    rec = PreprocessorsRegistry.get_item(pid)
    if rec is None:
        return None
    return PreprocessorDetailPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        source=read_preprocessor_source(rec),
    )


def update_preprocessor_record(pid: str, apply_fn) -> PreprocessorRecord | None:  # type: ignore[no-untyped-def]
    return PreprocessorsRegistry.update_item(pid, apply_fn)


def write_preprocessor_source(rec: PreprocessorRecord, source: str) -> None:
    PreprocessorPackageManager.write_preprocessor_package(
        rec.id,
        source,
        validators=[validate_source_syntax],
    )


def apply_preprocessor_patch(rec: PreprocessorRecord, patch: PreprocessorPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        rec.name = str(data["name"]).strip()
    if "description" in data:
        rec.description = "" if data["description"] is None else str(data["description"]).strip()


def delete_preprocessor(pid: str) -> PreprocessorRecord | None:
    rec = PreprocessorsRegistry.get_item(pid)
    if rec is None:
        return None
    PreprocessorPackageManager.delete_preprocessor_package(pid)
    return PreprocessorsRegistry.delete_item(pid)


def resolve_preprocessor_class(pid: str) -> type[DataPreprocessorBase] | None:
    rec = PreprocessorsRegistry.get_item(pid)
    if rec is None:
        return None
    try:
        return _load_preprocessor_from_file(pid, rec.source_path)
    except Exception:
        return None
