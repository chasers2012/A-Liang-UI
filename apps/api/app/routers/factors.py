from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.factor_registry import (
    delete_source_file,
    get_by_id,
    load_registry,
    read_source,
    save_registry,
    write_source,
)
from app.factor_schemas import (
    FactorCreate,
    FactorDetailPublic,
    FactorPatch,
    FactorRecord,
    FactorSummaryPublic,
    default_factor_source,
    new_factor_id,
    record_to_summary,
    utc_now_iso,
)
from app.factor_validate import validate_factor_name, validate_source_syntax

router = APIRouter(prefix="/factors", tags=["factors"])


def _detail(rec: FactorRecord) -> FactorDetailPublic:
    summary = record_to_summary(rec)
    return FactorDetailPublic(**summary.model_dump(), source=read_source(rec))


def _merge_patch(rec, patch: FactorPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        v = data["name"]
        if v is None or not str(v).strip():
            raise ValueError("name 不能为空")
        rec.name = str(v).strip()
    if "group" in data:
        rec.group = (data["group"] or "").strip() or "factor"
    if "group_label" in data:
        rec.group_label = (data["group_label"] or "").strip() or "因子"
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


@router.get("", response_model=list[FactorSummaryPublic])
def list_factors() -> list[FactorSummaryPublic]:
    reg = load_registry()
    return [record_to_summary(i) for i in reg.items]


@router.get("/{factor_id}", response_model=FactorDetailPublic)
def get_factor(factor_id: str) -> FactorDetailPublic:
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    return _detail(rec)


@router.post("", response_model=FactorDetailPublic)
def create_factor(body: FactorCreate) -> FactorDetailPublic:
    try:
        validate_factor_name(body.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    fid = new_factor_id()
    now = utc_now_iso()
    rec = body.to_record(fid, now)
    src = body.source if body.source is not None else default_factor_source(rec.name)
    try:
        validate_source_syntax(src)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    reg = load_registry()
    reg.items.append(rec)
    write_source(rec, src)
    save_registry(reg)
    return _detail(rec)


@router.patch("/{factor_id}", response_model=FactorDetailPublic)
def patch_factor(factor_id: str, body: FactorPatch) -> FactorDetailPublic:
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")

    unset = body.model_dump(exclude_unset=True)
    if "name" in unset:
        if body.name is None or not str(body.name).strip():
            raise HTTPException(status_code=400, detail="name 不能为空")
        try:
            validate_factor_name(str(body.name))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    if "max_window" in unset and body.max_window is not None and body.max_window < 1:
        raise HTTPException(status_code=400, detail="max_window 须 >= 1")

    try:
        _merge_patch(rec, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if "source" in unset and body.source is not None:
        try:
            validate_source_syntax(body.source)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        write_source(rec, body.source)

    rec.updated_at = utc_now_iso()
    save_registry(reg)
    return _detail(rec)


@router.delete("/{factor_id}", status_code=204)
def delete_factor(factor_id: str) -> None:
    reg = load_registry()
    rec = get_by_id(reg, factor_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="因子不存在")
    reg.items = [i for i in reg.items if i.id != factor_id]
    delete_source_file(rec)
    save_registry(reg)
