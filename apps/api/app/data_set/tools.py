from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from langchain_core.tools import tool

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


def _http_error_detail(exc: HTTPException) -> str:
    d = exc.detail
    return d if isinstance(d, str) else str(d)


@tool(
    description=(
        "创建数据集并持久化。"
        "入参 body 包含名称、描述、日期区间、标的列表及数据源绑定；"
        "至少需要一条绑定，多数据源时 dependencies 字段名不得重复。"
        "返回创建后的数据集详情。"
    )
)
def create_data_set(body: DataSetCreate) -> dict[str, Any]:
    try:
        created = create_data_set_controller(body)
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    return created.model_dump()


@tool(description="按 data_set_id 查询单个数据集详情；不存在时报错。")
def get_data_set_detail(data_set_id: str) -> dict[str, Any]:
    rec = get_data_set_detail_controller(data_set_id)
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@tool(description="获取当前工作区的数据集列表。")
def get_data_set_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_data_sets_controller()]


@tool(
    description=(
        "更新数据集。"
        "入参 data_set_id 与 body（DataSetPatch）；仅更新传入字段，"
        "语义与 PATCH /data-sets/{id} 保持一致。返回更新后的数据集详情。"
    )
)
def update_data_set(data_set_id: str, body: DataSetPatch) -> dict[str, Any]:
    try:
        rec = update_data_set_controller(data_set_id, body)
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@tool(description="删除数据集并返回删除前快照；不存在时报错。")
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
