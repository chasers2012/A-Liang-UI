from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.datasources.registry import get_by_id as ds_get_by_id
from app.datasources.registry import load_registry as load_ds_registry
from app.datasources.schemas import DataSourceRecord, utc_now_iso
from app.evaluation.test_set_schemas import (
    EvaluationTestSetCreate,
    EvaluationTestSetDatasourceBindingInput,
    EvaluationTestSetDatasourceBindingPublic,
    EvaluationTestSetDatasourceBindingStored,
    EvaluationTestSetPatch,
    EvaluationTestSetPublic,
    EvaluationTestSetRecord,
)
from app.evaluation.test_sets_store import (
    apply_default_uniqueness,
    get_by_id,
    load_file,
    save_file,
)

router = APIRouter(prefix="/evaluation-test-sets", tags=["evaluation-test-sets"])


def _ds_meta(reg_ds, ds_id: str) -> tuple[str, str]:
    r = ds_get_by_id(reg_ds, ds_id)
    if r is None:
        return "", ""
    return r.name, r.type


def _bindings_to_public(
    bindings: list[EvaluationTestSetDatasourceBindingStored], reg_ds
) -> list[EvaluationTestSetDatasourceBindingPublic]:
    out: list[EvaluationTestSetDatasourceBindingPublic] = []
    for b in bindings:
        name, typ = _ds_meta(reg_ds, b.datasource_id)
        out.append(
            EvaluationTestSetDatasourceBindingPublic(
                datasource_id=b.datasource_id,
                datasource_name=name,
                datasource_type=typ,
                dependencies=list(b.dependencies),
            )
        )
    return out


def _to_public(rec: EvaluationTestSetRecord, reg_ds) -> EvaluationTestSetPublic:
    return EvaluationTestSetPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        datasource_bindings=_bindings_to_public(rec.datasource_bindings, reg_ds),
        start=rec.start,
        end=rec.end,
        stock_codes=list(rec.stock_codes),
        quantiles=rec.quantiles,
        is_default=rec.is_default,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _validate_datasource_enabled(ds_id: str) -> DataSourceRecord:
    reg_ds = load_ds_registry()
    rec = ds_get_by_id(reg_ds, ds_id)
    if rec is None:
        raise HTTPException(status_code=400, detail="数据源不存在")
    if not rec.enabled:
        raise HTTPException(status_code=400, detail="数据源未启用，无法绑定到测试集")
    return rec


def _validate_bindings_inputs(
    bindings: list[EvaluationTestSetDatasourceBindingInput],
) -> None:
    if not bindings:
        raise HTTPException(status_code=400, detail="至少配置一条数据源绑定")
    n = len(bindings)
    seen_fields: set[str] = set()
    for b in bindings:
        ds = b.datasource_id.strip()
        if not ds:
            raise HTTPException(status_code=400, detail="数据源 id 不能为空")
        deps = [x.strip() for x in b.dependencies if str(x).strip()]
        if n > 1 and not deps:
            raise HTTPException(
                status_code=400,
                detail="多个数据源时，每条绑定必须填写 dependencies（因子依赖字段名，如 close、volume）",
            )
        for d in deps:
            if d in seen_fields:
                raise HTTPException(
                    status_code=400,
                    detail=f"依赖字段「{d}」不能同时出现在多条数据源绑定中",
                )
            seen_fields.add(d)


def _inputs_to_stored(
    bindings: list[EvaluationTestSetDatasourceBindingInput],
) -> list[EvaluationTestSetDatasourceBindingStored]:
    return [
        EvaluationTestSetDatasourceBindingStored(
            datasource_id=b.datasource_id.strip(),
            dependencies=[x.strip() for x in b.dependencies if str(x).strip()],
        )
        for b in bindings
    ]


def _validate_and_touch_datasources(
    bindings: list[EvaluationTestSetDatasourceBindingInput],
) -> None:
    _validate_bindings_inputs(bindings)
    for b in bindings:
        _validate_datasource_enabled(b.datasource_id.strip())


def _merge_patch(rec: EvaluationTestSetRecord, patch: EvaluationTestSetPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        rec.name = str(data["name"]).strip()
    if "description" in data:
        rec.description = (
            "" if data["description"] is None else str(data["description"]).strip()
        )
    if "datasource_bindings" in data and data["datasource_bindings"] is not None:
        raw = data["datasource_bindings"]
        inputs = [
            EvaluationTestSetDatasourceBindingInput.model_validate(x) for x in raw
        ]
        rec.datasource_bindings = _inputs_to_stored(inputs)
    if "start" in data and data["start"] is not None:
        rec.start = str(data["start"]).strip()
    if "end" in data and data["end"] is not None:
        rec.end = str(data["end"]).strip()
    if "stock_codes" in data and data["stock_codes"] is not None:
        rec.stock_codes = [
            c.strip() for c in data["stock_codes"] if str(c).strip()
        ]
    if "quantiles" in data and data["quantiles"] is not None:
        rec.quantiles = max(2, int(data["quantiles"]))
    if "is_default" in data:
        rec.is_default = bool(data["is_default"])


@router.get("", response_model=list[EvaluationTestSetPublic])
def list_evaluation_test_sets() -> list[EvaluationTestSetPublic]:
    reg = load_file()
    reg_ds = load_ds_registry()
    return [_to_public(i, reg_ds) for i in reg.items]


@router.get("/{ts_id}", response_model=EvaluationTestSetPublic)
def get_evaluation_test_set(ts_id: str) -> EvaluationTestSetPublic:
    reg = load_file()
    rec = get_by_id(reg, ts_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="测试集不存在")
    reg_ds = load_ds_registry()
    return _to_public(rec, reg_ds)


@router.post("", response_model=EvaluationTestSetPublic)
def create_evaluation_test_set(body: EvaluationTestSetCreate) -> EvaluationTestSetPublic:
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="名称不能为空")
    _validate_and_touch_datasources(list(body.datasource_bindings))

    reg = load_file()
    new_rec = body.to_record()
    if new_rec.is_default:
        for i in reg.items:
            i.is_default = False
    reg.items.append(new_rec)
    apply_default_uniqueness(reg.items)
    save_file(reg)
    reg_ds = load_ds_registry()
    return _to_public(new_rec, reg_ds)


@router.patch("/{ts_id}", response_model=EvaluationTestSetPublic)
def patch_evaluation_test_set(
    ts_id: str, body: EvaluationTestSetPatch
) -> EvaluationTestSetPublic:
    reg = load_file()
    rec = get_by_id(reg, ts_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="测试集不存在")

    if body.datasource_bindings is not None:
        _validate_and_touch_datasources(list(body.datasource_bindings))

    _merge_patch(rec, body)
    if not rec.name:
        raise HTTPException(status_code=400, detail="名称不能为空")
    if not rec.datasource_bindings:
        raise HTTPException(status_code=400, detail="至少保留一条数据源绑定")
    _validate_bindings_inputs(
        [
            EvaluationTestSetDatasourceBindingInput(
                datasource_id=b.datasource_id,
                dependencies=list(b.dependencies),
            )
            for b in rec.datasource_bindings
        ]
    )
    for b in rec.datasource_bindings:
        _validate_datasource_enabled(b.datasource_id)

    rec.updated_at = utc_now_iso()

    if rec.is_default:
        for i in reg.items:
            if i.id != rec.id:
                i.is_default = False

    apply_default_uniqueness(reg.items)
    save_file(reg)
    reg_ds = load_ds_registry()
    return _to_public(rec, reg_ds)


@router.delete("/{ts_id}", status_code=204)
def delete_evaluation_test_set(ts_id: str) -> None:
    reg = load_file()
    n = len(reg.items)
    reg.items = [i for i in reg.items if i.id != ts_id]
    if len(reg.items) == n:
        raise HTTPException(status_code=404, detail="测试集不存在")
    save_file(reg)
