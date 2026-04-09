from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.data_set.redistry import DataSetsStore
from app.data_set.schemas import (
    DataSetCreate,
    DataSetDatasourceBindingInput,
    DataSetDatasourceBindingPublic,
    DataSetDatasourceBindingStored,
    DataSetPatch,
    DataSetPublic,
    DataSetRecord,
)
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import DataSourceRecord, utc_now_iso

router = APIRouter(prefix="/data-sets", tags=["data-sets"])


def _ds_meta(ds_id: str) -> tuple[str, str]:
    r = DataSourceItemsRegistry.get_item(ds_id)
    if r is None:
        return "", ""
    return r.name, r.type


def _bindings_to_public(
    bindings: list[DataSetDatasourceBindingStored],
) -> list[DataSetDatasourceBindingPublic]:
    out: list[DataSetDatasourceBindingPublic] = []
    for b in bindings:
        name, typ = _ds_meta(b.datasource_id)
        out.append(
            DataSetDatasourceBindingPublic(
                datasource_id=b.datasource_id,
                datasource_name=name,
                datasource_type=typ,
                dependencies=list(b.dependencies),
                alias=(dict(b.alias) if b.alias else None),
                date_column=b.date_column.strip(),
                asset_column=b.asset_column.strip(),
            )
        )
    return out


def _to_public(rec: DataSetRecord) -> DataSetPublic:
    return DataSetPublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        datasource_bindings=_bindings_to_public(rec.datasource_bindings),
        start=rec.start,
        end=rec.end,
        stock_codes=list(rec.stock_codes),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _validate_datasource_enabled(ds_id: str) -> DataSourceRecord:
    rec = DataSourceItemsRegistry.get_item(ds_id)
    if rec is None:
        raise HTTPException(status_code=400, detail="数据源不存在")
    if not rec.enabled:
        raise HTTPException(status_code=400, detail="数据源未启用，无法绑定到数据集")
    return rec


def _validate_binding_alias(alias: dict | None) -> None:
    if alias is None:
        return
    for k, v in alias.items():
        kk = str(k).strip()
        vv = str(v).strip()
        if not kk or not vv:
            raise HTTPException(status_code=400, detail="alias 中的键和值均不能为空")


def _strip_deps(deps: list[str]) -> list[str]:
    return [x.strip() for x in deps if str(x).strip()]


def _validate_binding_dependencies(
    *,
    deps: list[str],
    require_non_empty: bool,
    seen_fields: set[str],
) -> None:
    if require_non_empty and not deps:
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


def _validate_bindings_inputs(
    bindings: list[DataSetDatasourceBindingInput],
) -> None:
    if not bindings:
        raise HTTPException(status_code=400, detail="至少配置一条数据源绑定")
    n = len(bindings)
    seen_fields: set[str] = set()
    for b in bindings:
        ds = b.datasource_id.strip()
        if not ds:
            raise HTTPException(status_code=400, detail="数据源 id 不能为空")
        if not b.date_column.strip() or not b.asset_column.strip():
            raise HTTPException(
                status_code=400, detail="每条绑定必须填写 date_column 与 asset_column"
            )
        _validate_binding_alias(b.alias)
        deps = _strip_deps(b.dependencies)
        _validate_binding_dependencies(
            deps=deps,
            require_non_empty=n > 1,
            seen_fields=seen_fields,
        )


def _inputs_to_stored(
    bindings: list[DataSetDatasourceBindingInput],
) -> list[DataSetDatasourceBindingStored]:
    return [
        DataSetDatasourceBindingStored(
            datasource_id=b.datasource_id.strip(),
            dependencies=[x.strip() for x in b.dependencies if str(x).strip()],
            alias=(dict(b.alias) if b.alias else None),
            date_column=b.date_column.strip(),
            asset_column=b.asset_column.strip(),
        )
        for b in bindings
    ]


def _validate_and_touch_datasources(
    bindings: list[DataSetDatasourceBindingInput],
) -> None:
    _validate_bindings_inputs(bindings)
    for b in bindings:
        _validate_datasource_enabled(b.datasource_id.strip())


def _merge_patch(rec: DataSetRecord, patch: DataSetPatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        rec.name = str(data["name"]).strip()
    if "description" in data:
        rec.description = "" if data["description"] is None else str(data["description"]).strip()
    if "datasource_bindings" in data and data["datasource_bindings"] is not None:
        raw = data["datasource_bindings"]
        inputs = [DataSetDatasourceBindingInput.model_validate(x) for x in raw]
        rec.datasource_bindings = _inputs_to_stored(inputs)
    if "start" in data and data["start"] is not None:
        rec.start = str(data["start"]).strip()
    if "end" in data and data["end"] is not None:
        rec.end = str(data["end"]).strip()
    if "stock_codes" in data and data["stock_codes"] is not None:
        rec.stock_codes = [c.strip() for c in data["stock_codes"] if str(c).strip()]


@router.get("", response_model=list[DataSetPublic])
def list_data_sets() -> list[DataSetPublic]:
    return [_to_public(i) for i in DataSetsStore.list_items()]


@router.get("/{data_set_id}", response_model=DataSetPublic)
def get_data_set(data_set_id: str) -> DataSetPublic:
    rec = DataSetsStore.get_item(data_set_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return _to_public(rec)


@router.post("", response_model=DataSetPublic)
def create_data_set(body: DataSetCreate) -> DataSetPublic:
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="名称不能为空")
    _validate_and_touch_datasources(list(body.datasource_bindings))

    new_rec = body.to_record()
    DataSetsStore.add_item(new_rec)
    return _to_public(new_rec)


@router.patch("/{data_set_id}", response_model=DataSetPublic)
def patch_data_set(data_set_id: str, body: DataSetPatch) -> DataSetPublic:

    def _apply(rec: DataSetRecord) -> None:
        if body.datasource_bindings is not None:
            _validate_and_touch_datasources(list(body.datasource_bindings))
        _merge_patch(rec, body)
        if not rec.name:
            raise HTTPException(status_code=400, detail="名称不能为空")
        if not rec.datasource_bindings:
            raise HTTPException(status_code=400, detail="至少保留一条数据源绑定")
        _validate_bindings_inputs(
            [
                DataSetDatasourceBindingInput(
                    datasource_id=b.datasource_id,
                    dependencies=list(b.dependencies),
                    alias=(dict(b.alias) if b.alias else None),
                    date_column=b.date_column,
                    asset_column=b.asset_column,
                )
                for b in rec.datasource_bindings
            ]
        )
        for b in rec.datasource_bindings:
            _validate_datasource_enabled(b.datasource_id)
        rec.updated_at = utc_now_iso()

    rec = DataSetsStore.update_item(data_set_id, _apply)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return _to_public(rec)


@router.delete("/{data_set_id}", status_code=204)
def delete_data_set(data_set_id: str) -> None:
    if DataSetsStore.delete_item(data_set_id) is None:
        raise HTTPException(status_code=404, detail="数据集不存在")
