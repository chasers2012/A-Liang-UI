from __future__ import annotations

from custom_code import SourceFiles, validate_identifier_name, validate_source_syntax

from app.datetime_utils import utc_now_iso
from app.factors.schemas import (
    FactorCreate,
    FactorPatch,
    FactorRecord,
    FactorRegistryFile,
)
from app.persistence.workspace_registry import WorkspaceItemsRegistry

resolve_source_path = SourceFiles.resolve_source_path

FACTORS_REGISTRY_FILENAME = "factors/registry.json"


def _merge_patch(rec, patch: FactorPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        v = data["name"]
        if v is None or not str(v).strip():
            raise ValueError("name 不能为空")
        rec.name = str(v).strip()
    if "group" in data:
        rec.group = (data["group"] or "").strip()
    if "description" in data:
        rec.description = (data["description"] or "").strip()
    if "max_window" in data:
        mw = data["max_window"]
        if mw is not None:
            rec.max_window = mw
    if "dependencies" in data and data["dependencies"] is not None:
        deps = [d.strip() for d in data["dependencies"] if str(d).strip()]
        if not deps:
            raise ValueError("dependencies 不能为空")
        rec.dependencies = deps


def _patch_factor_validate_and_merge(
    rec: FactorRecord,
    body: FactorPatch,
    unset: dict,
) -> None:
    if "name" in unset:
        if body.name is None or not str(body.name).strip():
            raise ValueError("name 不能为空")
        validate_identifier_name(str(body.name))

    if "max_window" in unset and body.max_window is not None and body.max_window < 1:
        raise ValueError("max_window 须 >= 1")

    _merge_patch(rec, body)


class FactorItemsRegistry(WorkspaceItemsRegistry[FactorRecord, FactorRegistryFile]):
    filename = FACTORS_REGISTRY_FILENAME
    file_model = FactorRegistryFile

    @classmethod
    def create_factor(cls, body: FactorCreate) -> FactorRecord:
        validate_identifier_name(body.name)

        fid = FactorItemsRegistry.generate_id()
        now = utc_now_iso()
        rec = body.to_record(fid, now)
        src = body.source
        SourceFiles.write_source_text(rec.source_path, src, validators=[validate_source_syntax])

        FactorItemsRegistry.add_item(rec)
        return rec

    @classmethod
    def update_factor(cls, factor_id: str, body: FactorPatch) -> FactorRecord:
        unset = body.model_dump(exclude_unset=True)

        def _apply(rec: FactorRecord) -> None:
            _patch_factor_validate_and_merge(rec, body, unset)
            if "source" in unset and body.source is not None:
                SourceFiles.write_source_text(
                    rec.source_path, body.source, validators=[validate_source_syntax]
                )
            rec.updated_at = utc_now_iso()

        return FactorItemsRegistry.update_item(factor_id, _apply)


def read_source(rec: FactorRecord) -> str:
    return SourceFiles.read_source_text(rec.source_path)


def delete_source_file(rec: FactorRecord) -> None:
    SourceFiles.delete_source_text_file(rec.source_path)
