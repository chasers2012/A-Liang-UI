from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.common.datetime_utils import utc_now_iso
from app.datasource.api import list_datasources
from app.datasource.plugins import get_datasource_plugin
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import (
    DataSourceCreate,
    DataSourcePatch,
    DataSourceRecord,
    TestResult,
    record_to_public,
)
from app.datasource.verify import verify_datasource


@tool(
    description=(
        "创建并保存一个数据源（插件化），返回创建后的数据源详情（对外展示结构，敏感字段会脱敏）。"
        "入参 body：name、type（如 sql/csv）、config（插件定义的 JSON）。"
    )
)
def create_datasource(body: DataSourceCreate) -> dict[str, Any]:
    plugin = get_datasource_plugin(str(body.type))
    validated = plugin.validate_config(dict(body.config or {}))
    new_rec = body.to_record()
    new_rec.config = validated
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
        "更新数据源字段（名称、config），返回更新后的详情。"
        "入参 datasource_id 与 body（DataSourcePatch，按需填写字段；config 为 replace 语义）。"
    )
)
def update_datasource(datasource_id: str, body: DataSourcePatch) -> dict[str, Any]:

    def _apply(rec: DataSourceRecord) -> None:
        data = body.model_dump(exclude_unset=True)
        if "name" in data:
            rec.name = data["name"]
        if "config" in data:
            plugin = get_datasource_plugin(str(rec.type))
            rec.config = plugin.validate_config(dict(data["config"] or {}))
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
    test_datasource_connection,
]
