from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.datasources.registry import get_by_id, load_registry, save_registry
from app.datasources.schemas import (
    DataSourceCreate,
    DataSourcePatch,
    DataSourcePublic,
    DataSourceRecord,
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


def _merge_patch(rec: DataSourceRecord, patch: DataSourcePatch) -> None:  # noqa: C901
    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        rec.name = data["name"]
    if "enabled" in data:
        rec.enabled = data["enabled"]

    if rec.type == "sql" and rec.sql and "sql" in data:
        sp = data["sql"]
        if "engine_url" in sp:
            v = sp["engine_url"]
            if v is None or (isinstance(v, str) and not v.strip()):
                rec.sql.engine_url = None
            else:
                rec.sql.engine_url = str(v).strip()
        if "db_driver" in sp and sp["db_driver"] is not None:
            rec.sql.db_driver = str(sp["db_driver"])
        if "db_host" in sp:
            hv = sp["db_host"]
            rec.sql.db_host = "" if hv is None else str(hv)
            if rec.sql.db_host.strip():
                rec.sql.engine_url = None
        if "db_port" in sp:
            rec.sql.db_port = sp["db_port"]
        if "db_username" in sp:
            uv = sp["db_username"]
            rec.sql.db_username = "" if uv is None else str(uv)
        if "db_password" in sp:
            pv = sp["db_password"]
            rec.sql.db_password = "" if pv is None else str(pv)
        if "db_name" in sp:
            nv = sp["db_name"]
            rec.sql.db_name = "" if nv is None else str(nv)
            if rec.sql.db_name.strip():
                rec.sql.engine_url = None
        if "table" in sp and sp["table"] is not None:
            rec.sql.table = str(sp["table"])
        if "date_column" in sp and sp["date_column"] is not None:
            rec.sql.date_column = str(sp["date_column"])
        if "asset_column" in sp and sp["asset_column"] is not None:
            rec.sql.asset_column = str(sp["asset_column"])
        if "column_map" in sp and sp["column_map"] is not None:
            rec.sql.column_map = dict(sp["column_map"])

    if rec.type == "csv" and rec.csv and "csv" in data:
        cp = data["csv"]
        if "path" in cp:
            rec.csv.path = cp["path"]
        if "date_column" in cp:
            rec.csv.date_column = cp["date_column"]
        if "asset_column" in cp:
            rec.csv.asset_column = cp["asset_column"]
        if "read_csv_kwargs" in cp:
            rec.csv.read_csv_kwargs = dict(cp["read_csv_kwargs"])


@router.get("", response_model=list[DataSourcePublic])
def list_datasources() -> list[DataSourcePublic]:
    reg = load_registry()
    return [record_to_public(i) for i in reg.items]


@router.post("/sql-table-columns", response_model=SqlTableColumnsResponse)
def sql_table_columns(body: SqlTableColumnsRequest) -> SqlTableColumnsResponse:
    stored = None
    if body.datasource_id:
        reg = load_registry()
        rec = get_by_id(reg, body.datasource_id)
        if rec is None or rec.type != "sql" or not rec.sql:
            raise HTTPException(status_code=404, detail="数据源不存在或非 SQL 类型")
        stored = rec.sql
    try:
        cfg = sql_config_for_column_listing(body, stored)
        cols = list_table_column_names(cfg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SqlTableColumnsResponse(columns=cols)


@router.get("/{ds_id}", response_model=DataSourcePublic)
def get_datasource(ds_id: str) -> DataSourcePublic:
    reg = load_registry()
    rec = get_by_id(reg, ds_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    return record_to_public(rec)


@router.post("", response_model=DataSourcePublic)
def create_datasource(body: DataSourceCreate) -> DataSourcePublic:
    reg = load_registry()
    new_rec = body.to_record()
    reg.items.append(new_rec)
    save_registry(reg)
    return record_to_public(new_rec)


@router.patch("/{ds_id}", response_model=DataSourcePublic)
def patch_datasource(ds_id: str, body: DataSourcePatch) -> DataSourcePublic:
    reg = load_registry()
    rec = get_by_id(reg, ds_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")

    unset = body.model_dump(exclude_unset=True)
    if rec.type == "csv" and "sql" in unset:
        raise HTTPException(status_code=400, detail="CSV 数据源不能更新 sql 字段")
    if rec.type == "sql" and "csv" in unset:
        raise HTTPException(status_code=400, detail="SQL 数据源不能更新 csv 字段")

    _merge_patch(rec, body)
    rec.updated_at = utc_now_iso()
    save_registry(reg)
    return record_to_public(rec)


@router.delete("/{ds_id}", status_code=204)
def delete_datasource(ds_id: str) -> None:
    reg = load_registry()
    n = len(reg.items)
    reg.items = [i for i in reg.items if i.id != ds_id]
    if len(reg.items) == n:
        raise HTTPException(status_code=404, detail="数据源不存在")
    save_registry(reg)


@router.post("/{ds_id}/test", response_model=TestResult)
def test_datasource_endpoint(ds_id: str) -> TestResult:
    reg = load_registry()
    rec = get_by_id(reg, ds_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="数据源不存在")
    ok, msg = verify_datasource(rec)
    return TestResult(ok=ok, message=msg)
