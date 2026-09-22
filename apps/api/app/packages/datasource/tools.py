from __future__ import annotations

from typing import Any

from app.infra.tooling.safe_tool import safe_tool
from app.packages.datasource import controller as datasource_controller
from app.packages.datasource.schemas import DataSourceCreate, DataSourcePatch
from app.packages.tool.models import ToolAuthorization


@safe_tool("create_datasource", parse_docstring=True)
def create_datasource(body: DataSourceCreate) -> dict[str, Any]:
    """
    创建并保存数据源。

    入参 `body` 包含 name/type/connection_config/columns_config；
    分段配置按原样校验并分段加密入库。

    Args:
        body: 数据源创建请求体。

    Returns:
        创建后的数据源公开信息（敏感字段已脱敏）。
    """
    return datasource_controller.create_datasource(body).model_dump()


@safe_tool("get_datasource_detail", parse_docstring=True)
def get_datasource_detail(datasource_id: str) -> dict[str, Any]:
    """
    查询单个数据源详情。

    Args:
        datasource_id: 数据源 ID；不存在需返回明确错误。

    Returns:
        数据源公开信息（敏感字段已脱敏）。
    """
    rec = datasource_controller.get_datasource_public(datasource_id)
    if rec is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return rec.model_dump()


@safe_tool("get_datasource_list", parse_docstring=True)
def get_datasource_list() -> list[dict[str, Any]]:
    """
    查询当前工作区数据源列表。

    Returns:
        数据源公开视图列表（敏感字段保持脱敏）。
    """
    return [f.model_dump() for f in datasource_controller.list_datasources()]


@safe_tool("update_datasource", parse_docstring=True)
def update_datasource(datasource_id: str, body: DataSourcePatch) -> dict[str, Any]:
    """
    更新数据源配置。

    仅更新传入字段；分段配置会按 ``connection_config`` / ``columns_config`` 覆盖并重新校验。

    Args:
        datasource_id: 数据源 ID。
        body: 更新请求体。

    Returns:
        更新后的数据源公开信息（敏感字段已脱敏）。
    """

    rec = datasource_controller.patch_datasource(datasource_id, body)
    if rec is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return rec.model_dump()


@safe_tool("delete_datasource", parse_docstring=True)
def delete_datasource(datasource_id: str) -> dict[str, Any]:
    """
    删除指定数据源。

    Args:
        datasource_id: 数据源 ID。

    Returns:
        删除前的公开信息（敏感字段已脱敏）。
    """
    rec = datasource_controller.get_datasource_public(datasource_id)
    if rec is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    if not datasource_controller.delete_datasource(datasource_id):
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return rec.model_dump()


@safe_tool("test_datasource_connection", parse_docstring=True)
def test_datasource_connection(datasource_id: str) -> dict[str, Any]:
    """
    测试数据源连接是否可用。

    Args:
        datasource_id: 数据源 ID。

    Returns:
        `{ok, message}` 用于诊断连接问题。
    """
    res = datasource_controller.test_datasource(datasource_id)
    if res is None:
        raise ValueError(f"数据源 {datasource_id} 不存在")
    return res.model_dump()


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
