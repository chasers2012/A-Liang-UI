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
        "创建并保存一个数据集：名称、描述、日期区间、标的代码列表，以及至少一条数据源绑定。"
        "多数据源时每条绑定需填写 dependencies（因子依赖字段名，如 close、volume），且同一字段不能重复出现在多条绑定中。"
    )
)
def create_data_set(body: DataSetCreate) -> dict[str, Any]:
    try:
        created = create_data_set_controller(body)
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    return created.model_dump()


@tool(description="获取单个数据集详情，入参 data_set_id 为数据集 id")
def get_data_set_detail(data_set_id: str) -> dict[str, Any]:
    rec = get_data_set_detail_controller(data_set_id)
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return rec.model_dump()


@tool(description="获取工作区内全部数据集列表")
def get_data_set_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_data_sets_controller()]


@tool(
    description=(
        "更新数据集（名称、描述、数据源绑定、起止日期、标的代码等），行为与 PATCH /data-sets/{id} 一致。"
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


@tool(description="删除数据集，成功时返回被删除记录的公开信息；不存在则报错")
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
