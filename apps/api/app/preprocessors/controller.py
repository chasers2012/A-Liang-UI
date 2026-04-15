from __future__ import annotations

from custom_code import SourceFiles, validate_source_syntax
from factor import DataPreprocessorBase

from app.common.datetime_utils import utc_now_iso
from app.preprocessors.models import PreprocessorRow
from app.preprocessors.package_manager import PreprocessorPackageManager
from app.preprocessors.registry import PreprocessorsRegistry
from app.preprocessors.schemas import (
    PreprocessorCreate,
    PreprocessorDetailPublic,
    PreprocessorPatch,
    PreprocessorSummaryPublic,
)


def _load_preprocessor_from_file(source_path: str) -> type[DataPreprocessorBase] | None:
    source_file = SourceFiles.resolve_source_path(source_path)
    if not source_file.is_file():
        return None

    source = SourceFiles.read_source_text(source_path)
    try:
        code = compile(source, source_path, "exec")
    except Exception:
        return None
    env: dict[str, object] = {}
    try:
        exec(code, env, env)
    except Exception:
        return None
    for obj in env.values():
        if not isinstance(obj, type):
            continue
        if obj is DataPreprocessorBase:
            continue
        if issubclass(obj, DataPreprocessorBase):
            return obj
    return None


def create_preprocessor(body: PreprocessorCreate, *, id_name: str | None = None) -> PreprocessorRow:
    pid = PreprocessorsRegistry.generate_id((id_name or "").strip() or None)
    if PreprocessorsRegistry.get_item(pid) is not None:
        raise ValueError(f"Preprocessor {pid} already exists")

    now = utc_now_iso()
    rec = body.to_row(pid, now)
    src = body.source or ""
    PreprocessorPackageManager.write_preprocessor_package(
        pid,
        src,
        validators=[validate_source_syntax],
    )

    # Best-effort metadata extraction from class source.
    cls = _load_preprocessor_from_file(rec.source_path)
    if cls is not None:
        label = getattr(cls, "label", None)
        if isinstance(label, str) and label.strip():
            rec.name = label.strip()
        rec.description = (
            getattr(cls, "description", rec.description)
            if isinstance(getattr(cls, "description", None), str)
            else rec.description
        )

    PreprocessorsRegistry.add_item(rec)
    return rec


def list_preprocessor_records() -> list[PreprocessorRow]:
    return PreprocessorsRegistry.list_items()


def get_preprocessor_record(pid: str) -> PreprocessorRow | None:
    return PreprocessorsRegistry.get_item(pid)


def read_preprocessor_source(rec: PreprocessorRow) -> str:
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


def update_preprocessor_record(pid: str, apply_fn) -> PreprocessorRow | None:  # type: ignore[no-untyped-def]
    return PreprocessorsRegistry.update_item(pid, apply_fn)


def write_preprocessor_source(rec: PreprocessorRow, source: str) -> None:
    PreprocessorPackageManager.write_preprocessor_package(
        rec.id,
        source,
        validators=[validate_source_syntax],
    )


def sync_preprocessor_metadata_from_source(rec: PreprocessorRow) -> None:
    cls = _load_preprocessor_from_file(rec.source_path)
    if cls is None:
        return
    label = getattr(cls, "label", None)
    if isinstance(label, str) and label.strip():
        rec.name = label.strip()


def apply_preprocessor_patch(rec: PreprocessorRow, patch: PreprocessorPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        rec.name = str(data["name"]).strip()
    if "description" in data:
        rec.description = "" if data["description"] is None else str(data["description"]).strip()


def delete_preprocessor(pid: str) -> PreprocessorRow | None:
    rec = PreprocessorsRegistry.get_item(pid)
    if rec is None:
        return None
    PreprocessorPackageManager.delete_preprocessor_package(pid)
    return PreprocessorsRegistry.delete_item(pid)


def resolve_preprocessor_class(pid: str) -> type[DataPreprocessorBase] | None:
    rec = PreprocessorsRegistry.get_item(pid)
    if rec is None:
        return None
    return _load_preprocessor_from_file(rec.source_path)
