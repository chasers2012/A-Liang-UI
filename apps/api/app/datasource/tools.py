from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.common.datetime_utils import utc_now_iso
from app.datasource.api import _merge_patch, list_datasources
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import (
    DataSourceCreate,
    DataSourcePatch,
    DataSourceRecord,
    SqlTableColumnsRequest,
    SqlTableColumnsResponse,
    TestResult,
    record_to_public,
)
from app.datasource.table_columns import (
    list_table_column_names,
    sql_config_for_column_listing,
)
from app.datasource.verify import verify_datasource


@tool(
    description=(
        "创建并保存一个数据源（SQL 或 CSV），返回创建后的数据源详情（对外展示结构，密码不返回明文）。"
        "入参 body：name、type（sql|csv）、enabled；"
        "type=sql 时需提供 sql（db_host、db_name、table 等）；"
        "type=csv 时需提供 csv（path）。"
    )
)
def create_datasource(body: DataSourceCreate) -> dict[str, Any]:
    new_rec = body.to_record()
    DataSourceItemsRegistry.add_item(new_rec)
    return record_to_public(new_rec).model_dump()


@tool(description="获取单个数据源详情，入参 datasource_id 为数据源 id")
def get_datasource_detail(datasource_id: str) -> dict[str, Any]:
    rec = DataSourceItemsRegistry.get_item(datasource_id)
    if rec is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return record_to_public(rec).model_dump()


@tool(description="获取工作区内全部数据源列表")
def get_datasource_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_datasources()]


@tool(
    description=(
        "更新数据源字段（名称、启用状态、以及对应类型下的 sql/csv 子字段），返回更新后的详情。"
        "入参 datasource_id 与 body（DataSourcePatch，按需填写字段）。"
    )
)
def update_datasource(datasource_id: str, body: DataSourcePatch) -> dict[str, Any]:
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec: DataSourceRecord) -> None:
        if rec.type == "csv" and "sql" in unset:
            raise ValueError("CSV 数据源不能更新 sql 字段")
        if rec.type == "sql" and "csv" in unset:
            raise ValueError("SQL 数据源不能更新 csv 字段")
        _merge_patch(rec, body)
        rec.updated_at = utc_now_iso()

    rec = DataSourceItemsRegistry.update_item(datasource_id, _apply)
    if rec is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return record_to_public(rec).model_dump()


@tool(description="删除数据源，成功时返回被删除记录的公开信息；不存在则报错")
def delete_datasource(datasource_id: str) -> dict[str, Any]:
    rec = DataSourceItemsRegistry.delete_item(datasource_id)
    if rec is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return record_to_public(rec).model_dump()


@tool(
    description=(
        "解析 SQL 表结构，返回指定表的列名列表。"
        "可只传连接信息与 table；也可传 datasource_id 合并已保存的 SQL 数据源连接信息后再查询。"
    )
)
def get_sql_table_columns(body: SqlTableColumnsRequest) -> dict[str, Any]:
    stored = None
    if body.datasource_id:
        ds_rec = DataSourceItemsRegistry.get_item(body.datasource_id)
        if ds_rec is None or ds_rec.type != "sql" or not ds_rec.sql:
            raise ValueError("数据源不存在或非 SQL 类型")
        stored = ds_rec.sql
    try:
        cfg = sql_config_for_column_listing(body, stored)
        cols = list_table_column_names(cfg)
    except ValueError as e:
        raise ValueError(str(e)) from e
    return SqlTableColumnsResponse(columns=cols).model_dump()


@tool(description="测试数据源连通性（读表或读 CSV），返回 ok 与 message")
def test_datasource_connection(datasource_id: str) -> dict[str, Any]:
    rec = DataSourceItemsRegistry.get_item(datasource_id)
    if rec is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    ok, msg = verify_datasource(rec)
    return TestResult(ok=ok, message=msg).model_dump()


DATASOURCE_CHAT_TOOLS = [
    create_datasource,
    get_datasource_detail,
    get_datasource_list,
    update_datasource,
    delete_datasource,
    get_sql_table_columns,
    test_datasource_connection,
]
