from __future__ import annotations

from data_source import VerifyResult
from fastapi import APIRouter, HTTPException

from app.datasource import controller as datasource_controller
from app.datasource.schemas import (
    DataSourceCreate,
    DatasourceDependencyFieldsResponse,
    DataSourcePatch,
    DatasourcePluginPublic,
    DataSourcePublic,
    InspectColumnsRequest,
    InspectColumnsResponse,
)

router = APIRouter(prefix="/datasources", tags=["datasources"])


@router.get("", response_model=list[DataSourcePublic])
def list_datasources() -> list[DataSourcePublic]:
    return datasource_controller.list_datasources()


@router.get("/plugins", response_model=list[DatasourcePluginPublic])
def list_datasource_plugins() -> list[DatasourcePluginPublic]:
    return datasource_controller.list_datasource_plugins()


@router.post("/inspect-columns", response_model=InspectColumnsResponse)
def inspect_columns(body: InspectColumnsRequest) -> InspectColumnsResponse:
    """
    Plugin-based column inspection.

    For now this is implemented for `type=sql` using the built-in SQL plugin.
    """
    try:
        return datasource_controller.inspect_columns(body)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    "/{ds_id}/dependency-fields",
    response_model=DatasourceDependencyFieldsResponse,
)
def get_datasource_dependency_fields(ds_id: str) -> DatasourceDependencyFieldsResponse:
    """供数据集绑定等场景列出该数据源可声明的因子依赖字段名。"""
    try:
        return datasource_controller.get_datasource_dependency_fields(ds_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{ds_id}", response_model=DataSourcePublic)
def get_datasource(ds_id: str) -> DataSourcePublic:
    rec = datasource_controller.get_datasource_public(ds_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    return rec


@router.post("", response_model=DataSourcePublic)
def create_datasource(body: DataSourceCreate) -> DataSourcePublic:
    try:
        return datasource_controller.create_datasource(body)
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/{ds_id}", response_model=DataSourcePublic)
def patch_datasource(ds_id: str, body: DataSourcePatch) -> DataSourcePublic:
    try:
        rec = datasource_controller.patch_datasource(ds_id, body)
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    return rec


@router.delete("/{ds_id}", status_code=204)
def delete_datasource(ds_id: str) -> None:
    if not datasource_controller.delete_datasource(ds_id):
        raise HTTPException(status_code=404, detail="数据源不存在")


@router.post("/{ds_id}/test", response_model=VerifyResult)
def test_datasource_endpoint(ds_id: str) -> VerifyResult:
    rec = datasource_controller.test_datasource(ds_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    return rec
