from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.datasource.controller import get_datasource as get_datasource_instance
from app.datasource.plugin_registry import PluginRegistry
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import (
    DataSourceCreate,
    DatasourceDependencyFieldsResponse,
    DataSourcePatch,
    DataSourcePublic,
    DataSourceRecord,
    InspectColumnsRequest,
    InspectColumnsResponse,
    TestResult,
    record_to_public,
    utc_now_iso,
)
from app.datasource.verify import verify_datasource

router = APIRouter(prefix="/datasources", tags=["datasources"])


@router.get("", response_model=list[DataSourcePublic])
def list_datasources() -> list[DataSourcePublic]:
    return [record_to_public(i) for i in DataSourceItemsRegistry.list_items()]


@router.post("/inspect-columns", response_model=InspectColumnsResponse)
def inspect_columns(body: InspectColumnsRequest) -> InspectColumnsResponse:
    """
    Plugin-based column inspection.

    For now this is implemented for `type=sql` using the built-in SQL plugin.
    """
    config: dict = {}
    ds_type: str | None = body.type
    if body.datasource_id:
        rec = DataSourceItemsRegistry.get_item(body.datasource_id)
        if rec is None:
            raise HTTPException(status_code=404, detail="数据源不存在")
        ds_type = str(rec.type)
        config = dict(rec.config or {})
        if body.config is not None:
            # replace semantics for overlay: if provided, it replaces saved config
            config = dict(body.config)
    else:
        if not ds_type:
            raise HTTPException(
                status_code=400, detail="type is required when datasource_id is not provided"
            )
        config = dict(body.config or {})

    try:
        plugin = PluginRegistry.instance().get(str(ds_type))
        validated = plugin.validate_config(config)
        if not hasattr(plugin, "list_table_columns"):
            raise ValueError(f"该数据源类型不支持列探测: {ds_type!r}")
        cols = plugin.list_table_columns(validated)
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return InspectColumnsResponse(columns=[str(c) for c in cols])


@router.get(
    "/{ds_id}/dependency-fields",
    response_model=DatasourceDependencyFieldsResponse,
)
def get_datasource_dependency_fields(ds_id: str) -> DatasourceDependencyFieldsResponse:
    """供数据集绑定等场景列出该数据源可声明的因子依赖字段名。"""
    try:
        inst = get_datasource_instance(ds_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if inst is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    try:
        fields = inst.list_columns()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return DatasourceDependencyFieldsResponse(fields=fields)


@router.get("/{ds_id}", response_model=DataSourcePublic)
def get_datasource(ds_id: str) -> DataSourcePublic:
    rec = DataSourceItemsRegistry.get_item(ds_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    return record_to_public(rec)


@router.post("", response_model=DataSourcePublic)
def create_datasource(body: DataSourceCreate) -> DataSourcePublic:
    try:
        plugin = PluginRegistry.instance().get(str(body.type))
        validated = plugin.validate_config(dict(body.config or {}))
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    new_rec = body.to_record()
    new_rec.config = validated
    DataSourceItemsRegistry.add_item(new_rec)
    return record_to_public(new_rec)


@router.patch("/{ds_id}", response_model=DataSourcePublic)
def patch_datasource(ds_id: str, body: DataSourcePatch) -> DataSourcePublic:
    def _apply(rec: DataSourceRecord) -> None:
        data = body.model_dump(exclude_unset=True)
        if "name" in data:
            rec.name = data["name"]
        if "enabled" in data:
            rec.enabled = data["enabled"]
        if "config" in data:
            try:
                plugin = PluginRegistry.instance().get(str(rec.type))
                rec.config = plugin.validate_config(dict(data["config"] or {}))
            except (ValueError, TypeError) as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        rec.updated_at = utc_now_iso()

    rec = DataSourceItemsRegistry.update_item(ds_id, _apply)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    return record_to_public(rec)


@router.delete("/{ds_id}", status_code=204)
def delete_datasource(ds_id: str) -> None:
    if DataSourceItemsRegistry.delete_item(ds_id) is None:
        raise HTTPException(status_code=404, detail="数据源不存在")


@router.post("/{ds_id}/test", response_model=TestResult)
def test_datasource_endpoint(ds_id: str) -> TestResult:
    rec = DataSourceItemsRegistry.get_item(ds_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    ok, msg = verify_datasource(rec)
    return TestResult(ok=ok, message=msg)
