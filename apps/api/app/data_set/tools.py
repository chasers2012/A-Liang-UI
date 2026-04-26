from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.data_set.controller import (
    create_data_set as create_data_set_controller,
)
from app.data_set.controller import (
    delete_data_set as delete_data_set_controller,
)
from app.data_set.controller import (
    get_data_set_detail as get_data_set_detail_controller,
)
from app.data_set.controller import (
    list_data_sets as list_data_sets_controller,
)
from app.data_set.controller import (
    update_data_set as update_data_set_controller,
)
from app.data_set.schemas import DataSetCreate, DataSetPatch
from app.tool.safe_tool import safe_tool


def _http_error_detail(exc: HTTPException) -> str:
    d = exc.detail
    return d if isinstance(d, str) else str(d)


@safe_tool(
    "创建数据集",
    description=(
        "创建并保存数据集。\n入参 body 包含日期区间、标的与数据源绑定；至少一条绑定，多数据源时 dependencies 名称不得重复。"
    ),
)
def create_data_set(body: DataSetCreate) -> dict[str, Any]:
    try:
        created = create_data_set_controller(body)
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    return created.model_dump()


@safe_tool("获取数据集详情", description="查询单个数据集详情。\n入参 data_set_id；不存在需报错。")
def get_data_set_detail(data_set_id: str) -> dict[str, Any]:
    rec = get_data_set_detail_controller(data_set_id)
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@safe_tool(
    "获取数据集列表", description="查询当前工作区数据集列表。\n返回列表供后续运行或编辑选择。"
)
def get_data_set_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_data_sets_controller()]


@safe_tool(
    "更新数据集",
    description="更新数据集配置。\n入参 data_set_id 与 DataSetPatch；仅更新传入字段，语义与 PATCH 接口一致。",
)
def update_data_set(data_set_id: str, body: DataSetPatch) -> dict[str, Any]:
    try:
        rec = update_data_set_controller(data_set_id, body)
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@safe_tool("删除数据集", description="删除指定数据集。\n入参 data_set_id；返回删除前快照。")
def delete_data_set(data_set_id: str) -> dict[str, Any]:
    rec = get_data_set_detail_controller(data_set_id)
    if rec is None or not delete_data_set_controller(data_set_id):
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


DATA_SET_CHAT_TOOLS = [
    create_data_set,
    get_data_set_detail,
    get_data_set_list,
    update_data_set,
    delete_data_set,
]
