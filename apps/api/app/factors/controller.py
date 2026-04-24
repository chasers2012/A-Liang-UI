from __future__ import annotations

import importlib.util
import inspect
import re
import sys

from custom_code import SourceFiles, validate_identifier_name, validate_source_syntax
from factor import Factor

from app.common.datetime_utils import utc_now_iso
from app.factors.models import FactorRow
from app.factors.registry import FactorItemsRegistry
from app.factors.schemas import (
    FactorCreate,
    FactorDetailPublic,
    FactorParamSpecPublic,
    FactorPatch,
    FactorSummaryPublic,
    generate_id,
    row_to_summary,
)

resolve_source_path = SourceFiles.resolve_source_path


def merge_factor_patch(rec: FactorRow, patch: FactorPatch) -> None:
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
    if "dependencies" in data and data["dependencies"] is not None:
        deps = [d.strip() for d in data["dependencies"] if str(d).strip()]
        if not deps:
            raise ValueError("dependencies 不能为空")
        rec.dependencies = deps


def patch_factor_validate_and_merge(
    rec: FactorRow,
    body: FactorPatch,
    unset: dict,
) -> None:
    if "name" in unset:
        if body.name is None or not str(body.name).strip():
            raise ValueError("name 不能为空")
        validate_identifier_name(str(body.name))

    merge_factor_patch(rec, body)


def create_factor(body: FactorCreate) -> FactorRow:
    validate_identifier_name(body.name)

    fid = generate_id()
    now = utc_now_iso()
    rec = body.to_row(fid, now)
    SourceFiles.write_source_text(rec.source_path, body.source, validators=[validate_source_syntax])
    return FactorItemsRegistry.add_item(rec)


def update_factor(factor_id: str, body: FactorPatch) -> FactorRow:
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec: FactorRow) -> None:
        if rec.is_plugin:
            raise ValueError("cannot patch plugin factor")
        patch_factor_validate_and_merge(rec, body, unset)
        if "source" in unset and body.source is not None:
            SourceFiles.write_source_text(
                rec.source_path, body.source, validators=[validate_source_syntax]
            )
        rec.updated_at = utc_now_iso()

    return FactorItemsRegistry.update_item(factor_id, _apply)


def _load_user_factor_module(factor_id: str, source_path: str):
    source_file = resolve_source_path(source_path)
    if not source_file.is_file():
        return None
    safe_id = re.sub(r"\W+", "_", factor_id)
    module_name = f"_quant_agent_user_factor_{safe_id}"
    spec = importlib.util.spec_from_file_location(module_name, str(source_file))
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _pick_factor_class(module, expected_name: str) -> type[Factor] | None:
    candidates = [
        obj
        for obj in module.__dict__.values()
        if isinstance(obj, type) and issubclass(obj, Factor) and obj is not Factor
    ]
    if not candidates:
        return None
    for factor_cls in candidates:
        candidate_name = getattr(factor_cls, "name", None)
        if isinstance(candidate_name, str) and candidate_name.strip() == expected_name:
            return factor_cls
    return candidates[0]


def get_factor(factor_id: str) -> type[Factor] | None:
    rec = FactorItemsRegistry.get_item(factor_id)
    if rec is None:
        return None
    plugin_factor = FactorItemsRegistry.get_plugin_factor(factor_id)
    if plugin_factor is not None:
        return plugin_factor
    try:
        module = _load_user_factor_module(factor_id, rec.source_path)
        if module is None:
            return None
        return _pick_factor_class(module, rec.name)
    except Exception:
        return None


def read_factor_source(rec: FactorRow) -> str:
    plugin_factor = FactorItemsRegistry.get_plugin_factor(rec.id)
    if plugin_factor is not None:
        try:
            return inspect.getsource(plugin_factor)
        except (OSError, TypeError):
            return f"# 无法读取插件因子类 {rec.id} 的源码（可能为内置或动态定义）。\n"
    return SourceFiles.read_source_text(rec.source_path)


def delete_factor_source_file(rec: FactorRow) -> None:
    if FactorItemsRegistry.get_plugin_factor(rec.id) is not None:
        return
    SourceFiles.delete_source_text_file(rec.source_path)


def factor_detail(rec: FactorRow) -> FactorDetailPublic:
    summary = row_to_summary(rec)
    return FactorDetailPublic(**summary.model_dump(), source=read_factor_source(rec))


def list_factors() -> list[FactorSummaryPublic]:
    return [row_to_summary(i) for i in FactorItemsRegistry.list_items()]


def list_factor_param_specs(factor_id: str) -> list[FactorParamSpecPublic]:
    factor_cls = get_factor(factor_id)
    if factor_cls is None:
        raise ValueError("因子不存在或无法加载")
    out: list[FactorParamSpecPublic] = []
    for spec in factor_cls.get_param_specs():
        out.append(
            FactorParamSpecPublic(
                name=spec["name"],
                label=str(spec.get("label") or spec["name"]),
                description=str(spec.get("description") or ""),
                default=spec.get("default"),
                min=spec.get("min"),
                max=spec.get("max"),
            )
        )
    return out
