from __future__ import annotations

import importlib.util
import re
import sys

from custom_code import SourceFiles, validate_identifier_name, validate_source_syntax
from factor import Factor

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

    @classmethod
    def get_factor(cls, factor_id: str) -> type[Factor] | None:
        rec = cls.get_item(factor_id)
        if rec is None:
            return None
        # Load user-written Factor source from ``source_path`` and return the
        # Factor subclass (not an instance).
        #
        # Note: evaluation workflow passes this class into nodes which then
        # instantiate it with a DependencyResolver.
        try:
            source_file = resolve_source_path(rec.source_path)
            if not source_file.is_file():
                return None

            safe_id = re.sub(r"\W+", "_", factor_id)
            module_name = f"_quant_agent_user_factor_{safe_id}"
            spec = importlib.util.spec_from_file_location(
                module_name,
                str(source_file),
            )
            if spec is None or spec.loader is None:
                return None

            module = importlib.util.module_from_spec(spec)
            # Ensure reload on updates: replace the module object under same key.
            sys.modules[module_name] = module
            spec.loader.exec_module(module)

            candidates: list[type[Factor]] = []
            for obj in module.__dict__.values():
                if isinstance(obj, type) and issubclass(obj, Factor) and obj is not Factor:
                    candidates.append(obj)

            if not candidates:
                return None

            # Prefer a class whose declared ``name`` matches the registry record.
            for c in candidates:
                n = getattr(c, "name", None)
                if isinstance(n, str) and n.strip() == rec.name:
                    return c

            # Fall back to the first subclass found.
            return candidates[0]
        except Exception:
            # Keep get_factor non-throwing so callers (e.g. evaluation) can
            # surface failures as evaluation errors.
            return None


def read_source(rec: FactorRecord) -> str:
    return SourceFiles.read_source_text(rec.source_path)


def delete_source_file(rec: FactorRecord) -> None:
    SourceFiles.delete_source_text_file(rec.source_path)
