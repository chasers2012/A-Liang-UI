from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.datasources.controller import get_datasource as get_datasource_instance
from app.datasources.registry import DataSourceItemsRegistry
from app.datasources.schemas import (
    DataSourceCreate,
    DatasourceDependencyFieldsResponse,
    DataSourcePatch,
    DataSourcePublic,
    DataSourceRecord,
    SqlConfigStored,
    SqlTableColumnsRequest,
    SqlTableColumnsResponse,
    TestResult,
    record_to_public,
    utc_now_iso,
)
from app.datasources.table_columns import (
    list_table_column_names,
    sql_config_for_column_listing,
)
from app.datasources.verify import verify_datasource

router = APIRouter(prefix="/datasources", tags=["datasources"])


def _merge_sql_credentials(sql: SqlConfigStored, sp: dict[str, Any]) -> None:
    if "db_driver" in sp and sp["db_driver"] is not None:
        sql.db_driver = str(sp["db_driver"])
    if "db_host" in sp:
        hv = sp["db_host"]
        sql.db_host = "" if hv is None else str(hv)
    if "db_port" in sp:
        sql.db_port = sp["db_port"]
    if "db_username" in sp:
        uv = sp["db_username"]
        sql.db_username = "" if uv is None else str(uv)
    if "db_password" in sp:
        pv = sp["db_password"]
        sql.db_password = "" if pv is None else str(pv)
    if "db_name" in sp:
        nv = sp["db_name"]
        sql.db_name = "" if nv is None else str(nv)


def _merge_sql_table_mapping(sql: SqlConfigStored, sp: dict[str, Any]) -> None:
    if "table" in sp and sp["table"] is not None:
        sql.table = str(sp["table"])
    if "date_column" in sp and sp["date_column"] is not None:
        sql.date_column = str(sp["date_column"])
    if "asset_column" in sp and sp["asset_column"] is not None:
        sql.asset_column = str(sp["asset_column"])
    if "column_map" in sp and sp["column_map"] is not None:
        sql.column_map = dict(sp["column_map"])


def _merge_sql_subpatch(sql: SqlConfigStored, sp: dict[str, Any]) -> None:
    _merge_sql_credentials(sql, sp)
    _merge_sql_table_mapping(sql, sp)


def _merge_csv_subpatch(rec: DataSourceRecord, cp: dict[str, Any]) -> None:
    assert rec.csv is not None
    if "path" in cp:
        rec.csv.path = cp["path"]
    if "date_column" in cp:
        rec.csv.date_column = cp["date_column"]
    if "asset_column" in cp:
        rec.csv.asset_column = cp["asset_column"]
    if "read_csv_kwargs" in cp:
        rec.csv.read_csv_kwargs = dict(cp["read_csv_kwargs"])


def _merge_patch(rec: DataSourceRecord, patch: DataSourcePatch) -> None:
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        rec.name = data["name"]
    if "enabled" in data:
        rec.enabled = data["enabled"]

    if rec.type == "sql" and rec.sql and "sql" in data:
        _merge_sql_subpatch(rec.sql, data["sql"])
    if rec.type == "csv" and rec.csv and "csv" in data:
        _merge_csv_subpatch(rec, data["csv"])


@router.get("", response_model=list[DataSourcePublic])
def list_datasources() -> list[DataSourcePublic]:
    return [record_to_public(i) for i in DataSourceItemsRegistry.list_items()]


@router.post("/sql-table-columns", response_model=SqlTableColumnsResponse)
def sql_table_columns(body: SqlTableColumnsRequest) -> SqlTableColumnsResponse:
    stored = None
    if body.datasource_id:
        rec = DataSourceItemsRegistry.get_item(body.datasource_id)
        if rec is None or rec.type != "sql" or not rec.sql:
            raise HTTPException(status_code=404, detail="数据源不存在或非 SQL 类型")
        stored = rec.sql
    try:
        cfg = sql_config_for_column_listing(body, stored)
        cols = list_table_column_names(cfg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SqlTableColumnsResponse(columns=cols)


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
    new_rec = body.to_record()
    DataSourceItemsRegistry.add_item(new_rec)
    return record_to_public(new_rec)


@router.patch("/{ds_id}", response_model=DataSourcePublic)
def patch_datasource(ds_id: str, body: DataSourcePatch) -> DataSourcePublic:
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec: DataSourceRecord) -> None:
        if rec.type == "csv" and "sql" in unset:
            raise HTTPException(status_code=400, detail="CSV 数据源不能更新 sql 字段")
        if rec.type == "sql" and "csv" in unset:
            raise HTTPException(status_code=400, detail="SQL 数据源不能更新 csv 字段")
        _merge_patch(rec, body)
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
