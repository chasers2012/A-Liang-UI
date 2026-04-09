from __future__ import annotations

from custom_code import SourceFiles, validate_source_syntax
from workflow import Node, WorkflowNodeLoader

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


def _load_preprocessor_from_file(source_path: str) -> type[Node] | None:
    source_file = SourceFiles.resolve_source_path(source_path)
    if not source_file.is_file():
        return None

    source = SourceFiles.read_source_text(source_path)
    try:
        node_cls = WorkflowNodeLoader.load_workflow_node_class_from_source(source)
    except Exception:
        return None

    if not issubclass(node_cls, Node) or node_cls is Node:
        return None
    return node_cls


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


def sync_preprocessor_metadata_from_source(rec: PreprocessorRecord) -> None:
    cls = _load_preprocessor_from_file(rec.source_path)
    if cls is None:
        return
    label = getattr(cls, "label", None)
    if isinstance(label, str) and label.strip():
        rec.name = label.strip()


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


def resolve_preprocessor_class(pid: str) -> type[Node] | None:
    rec = PreprocessorsRegistry.get_item(pid)
    if rec is None:
        return None
    return _load_preprocessor_from_file(rec.source_path)
