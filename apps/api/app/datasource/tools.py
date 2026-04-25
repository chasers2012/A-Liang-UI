from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.common.datetime_utils import utc_now_iso
from app.datasource.api import list_datasources
from app.datasource.models import DataSourceRow
from app.datasource.plugins import get_datasource_plugin
from app.datasource.registry import DataSourceItemsRegistry
from app.datasource.schemas import (
    DataSourceCreate,
    DataSourcePatch,
    TestResult,
    row_to_public,
)
from app.datasource.verify import verify_datasource


@tool(
    "创建数据源",
    description=(
        "创建数据源并持久化。"
        "入参 body：name、type（如 sql/csv）、config（插件定义的 JSON 配置）。"
        "返回创建后的数据源详情（公开视图，敏感字段已脱敏）。"
    ),
)
def create_datasource(body: DataSourceCreate) -> dict[str, Any]:
    plugin = get_datasource_plugin(str(body.type))
    validated = plugin.validate_config(dict(body.config or {}))
    new_row = body.to_row()
    new_row.config = validated
    created_row = DataSourceItemsRegistry.add_item(new_row)
    return row_to_public(created_row).model_dump()


@tool("获取数据源详情", description="按 datasource_id 查询单个数据源详情；不存在时报错。")
def get_datasource_detail(datasource_id: str) -> dict[str, Any]:
    row = DataSourceItemsRegistry.get_item(datasource_id)
    if row is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return row_to_public(row).model_dump()


@tool("获取数据源列表", description="获取当前工作区的数据源列表（公开视图）。")
def get_datasource_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_datasources()]


@tool(
    "更新数据源",
    description=(
        "更新数据源。"
        "入参 datasource_id 与 body（DataSourcePatch）；仅更新传入字段。"
        "当提供 config 时按整体替换语义处理。返回更新后的数据源详情。"
    ),
)
def update_datasource(datasource_id: str, body: DataSourcePatch) -> dict[str, Any]:

    def _apply(row: DataSourceRow) -> None:
        data = body.model_dump(exclude_unset=True)
        if "name" in data:
            row.name = data["name"]
        if "config" in data:
            plugin = get_datasource_plugin(str(row.type))
            row.config = plugin.validate_config(dict(data["config"] or {}))
        row.updated_at = utc_now_iso()

    row = DataSourceItemsRegistry.update_item(datasource_id, _apply)
    if row is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return row_to_public(row).model_dump()


@tool("删除数据源", description="删除数据源并返回删除前的公开信息；不存在时报错。")
def delete_datasource(datasource_id: str) -> dict[str, Any]:
    row = DataSourceItemsRegistry.delete_item(datasource_id)
    if row is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return row_to_public(row).model_dump()


@tool("测试数据源连通性", description="测试数据源连通性（如读表/读 CSV）；返回 {ok, message}。")
def test_datasource_connection(datasource_id: str) -> dict[str, Any]:
    row = DataSourceItemsRegistry.get_item(datasource_id)
    if row is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    ok, msg = verify_datasource(row)
    return TestResult(ok=ok, message=msg).model_dump()


DATASOURCE_CHAT_TOOLS = [
    create_datasource,
    get_datasource_detail,
    get_datasource_list,
    update_datasource,
    delete_datasource,
    test_datasource_connection,
]
