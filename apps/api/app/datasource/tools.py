from __future__ import annotations

from typing import Any

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
from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool


@safe_tool("创建数据源", parse_docstring=True)
def create_datasource(body: DataSourceCreate) -> dict[str, Any]:
    """
    创建并保存数据源。

    入参 `body` 包含 name/type/config；config 会先按插件规则校验，返回脱敏后的公开视图。

    Args:
        body: 数据源创建请求体。

    Returns:
        创建后的数据源公开信息（敏感字段已脱敏）。
    """
    plugin = get_datasource_plugin(str(body.type))
    validated = plugin.validate_config(dict(body.config or {}))
    new_row = body.to_row()
    new_row.config = validated
    created_row = DataSourceItemsRegistry.add_item(new_row)
    return row_to_public(created_row).model_dump()


@safe_tool("获取数据源详情", parse_docstring=True)
def get_datasource_detail(datasource_id: str) -> dict[str, Any]:
    """
    查询单个数据源详情。

    Args:
        datasource_id: 数据源 ID；不存在需返回明确错误。

    Returns:
        数据源公开信息（敏感字段已脱敏）。
    """
    row = DataSourceItemsRegistry.get_item(datasource_id)
    if row is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return row_to_public(row).model_dump()


@safe_tool("获取数据源列表", parse_docstring=True)
def get_datasource_list() -> list[dict[str, Any]]:
    """
    查询当前工作区数据源列表。

    Returns:
        数据源公开视图列表（敏感字段保持脱敏）。
    """
    return [f.model_dump() for f in list_datasources()]


@safe_tool("更新数据源", parse_docstring=True)
def update_datasource(datasource_id: str, body: DataSourcePatch) -> dict[str, Any]:
    """
    更新数据源配置。

    仅更新传入字段；`config` 采用整体替换并重新校验。

    Args:
        datasource_id: 数据源 ID。
        body: 更新请求体。

    Returns:
        更新后的数据源公开信息（敏感字段已脱敏）。
    """

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


@safe_tool("删除数据源", parse_docstring=True)
def delete_datasource(datasource_id: str) -> dict[str, Any]:
    """
    删除指定数据源。

    Args:
        datasource_id: 数据源 ID。

    Returns:
        删除前的公开信息（敏感字段已脱敏）。
    """
    row = DataSourceItemsRegistry.delete_item(datasource_id)
    if row is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return row_to_public(row).model_dump()


@safe_tool("测试数据源连通性", parse_docstring=True)
def test_datasource_connection(datasource_id: str) -> dict[str, Any]:
    """
    测试数据源连接是否可用。

    Args:
        datasource_id: 数据源 ID。

    Returns:
        `{ok, message}` 用于诊断连接问题。
    """
    row = DataSourceItemsRegistry.get_item(datasource_id)
    if row is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    ok, msg = verify_datasource(row)
    return TestResult(ok=ok, message=msg).model_dump()


TOOLS = {
    "datasource.create_datasource": (create_datasource, ToolAuthorization.allowed),
    "datasource.get_datasource_detail": (get_datasource_detail, ToolAuthorization.allowed),
    "datasource.get_datasource_list": (get_datasource_list, ToolAuthorization.allowed),
    "datasource.update_datasource": (update_datasource, ToolAuthorization.need_authorize),
    "datasource.delete_datasource": (delete_datasource, ToolAuthorization.disabled),
    "datasource.test_datasource_connection": (
        test_datasource_connection,
        ToolAuthorization.allowed,
    ),
}
