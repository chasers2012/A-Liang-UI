from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.packages.data_set.schemas import DataSetCreate, DataSetPatch
from app.packages.tool.models import ToolAuthorization
from app.packages.tool.safe_tool import safe_tool

from . import controller


def _http_error_detail(exc: HTTPException) -> str:
    d = exc.detail
    return d if isinstance(d, str) else str(d)


@safe_tool("create_data_set", parse_docstring=True)
def create_data_set(body: DataSetCreate) -> dict[str, Any]:
    """
    创建并保存数据集。

    入参 `body` 包含日期区间、标的与数据源绑定；至少一条绑定，columns 名称不得重复。

    Args:
        body: 数据集创建请求体。

    Returns:
        创建后的数据集详情。
    """
    try:
        created = controller.create_data_set(body)
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    return created.model_dump()


@safe_tool("get_data_set_detail", parse_docstring=True)
def get_data_set_detail(data_set_id: str) -> dict[str, Any]:
    """
    查询单个数据集详情。

    Args:
        data_set_id: 数据集 ID（UUID）。

    Returns:
        数据集详情。
    """
    rec = controller.get_data_set_detail(data_set_id)
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@safe_tool("get_data_set_list", parse_docstring=True)
def get_data_set_list() -> list[dict[str, Any]]:
    """
    查询当前工作区数据集列表。

    Returns:
        数据集列表，用于后续运行或编辑选择。
    """
    return [f.model_dump() for f in controller.list_data_sets()]


@safe_tool("update_data_set", parse_docstring=True)
def update_data_set(data_set_id: str, body: DataSetPatch) -> dict[str, Any]:
    """
    更新数据集配置。

    仅更新传入字段，语义与 PATCH 接口一致。

    Args:
        data_set_id: 数据集 ID。
        body: 数据集更新内容。

    Returns:
        更新后的数据集详情。
    """
    try:
        rec = controller.update_data_set(data_set_id, body)
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@safe_tool("delete_data_set", parse_docstring=True)
def delete_data_set(data_set_id: str) -> dict[str, Any]:
    """
    删除指定数据集。

    Args:
        data_set_id: 数据集 ID。

    Returns:
        删除前快照。
    """
    rec = controller.get_data_set_detail(data_set_id)
    if rec is None or not controller.delete_data_set(data_set_id):
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@safe_tool("get_data_set_panel_preview", parse_docstring=True)
def get_data_set_panel_preview(
    data_set_id: str,
    limit: int = 200,
    sample_bdays: int = 5,
    window: int = 0,
) -> dict[str, Any]:
    """
    预览数据集的一段数据，用于验证数据集是否可正常使用。

    Args:
        data_set_id: 数据集 ID。
        limit: 返回行数上限。
        sample_bdays: 抽样交易日数量。
        window: 额外窗口大小（由后端解释）。

    Returns:
        数据集预览结果。
    """
    return controller.get_data_set_panel_preview(
        data_set_id=data_set_id,
        limit=limit,
        sample_bdays=sample_bdays,
        window=window,
    )


TOOLS = {
    "data_set.create_data_set": (create_data_set, ToolAuthorization.allowed),
    "data_set.get_data_set_detail": (get_data_set_detail, ToolAuthorization.allowed),
    "data_set.get_data_set_list": (get_data_set_list, ToolAuthorization.allowed),
    "data_set.update_data_set": (update_data_set, ToolAuthorization.need_authorize),
    "data_set.delete_data_set": (delete_data_set, ToolAuthorization.disabled),
    "data_set.get_data_set_panel_preview": (
        get_data_set_panel_preview,
        ToolAuthorization.allowed,
    ),
}
