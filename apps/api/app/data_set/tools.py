from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from langchain_core.tools import tool

from app.data_set.api import (
    _merge_patch,
    _to_public,
    _validate_and_touch_datasources,
    _validate_bindings_inputs,
    _validate_datasource_exists,
    list_data_sets,
)
from app.data_set.redistry import DataSetsStore
from app.data_set.schemas import (
    DataSetCreate,
    DataSetDatasourceBindingInput,
    DataSetPatch,
    DataSetRecord,
)
from app.datasource.schemas import utc_now_iso


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
    if not body.name.strip():
        raise ValueError("名称不能为空")
    try:
        _validate_and_touch_datasources(list(body.datasource_bindings))
    except HTTPException as e:
        raise ValueError(_http_error_detail(e)) from e
    new_rec = body.to_record()
    DataSetsStore.add_item(new_rec)
    return _to_public(new_rec).model_dump()


@tool(description="获取单个数据集详情，入参 data_set_id 为数据集 id")
def get_data_set_detail(data_set_id: str) -> dict[str, Any]:
    rec = DataSetsStore.get_item(data_set_id)
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return _to_public(rec).model_dump()


@tool(description="获取工作区内全部数据集列表")
def get_data_set_list() -> list[dict[str, Any]]:
    return [f.model_dump() for f in list_data_sets()]


@tool(
    description=(
        "更新数据集（名称、描述、数据源绑定、起止日期、标的代码等），行为与 PATCH /data-sets/{id} 一致。"
    )
)
def update_data_set(data_set_id: str, body: DataSetPatch) -> dict[str, Any]:

    def _apply(rec: DataSetRecord) -> None:
        try:
            if body.datasource_bindings is not None:
                _validate_and_touch_datasources(list(body.datasource_bindings))
        except HTTPException as e:
            raise ValueError(_http_error_detail(e)) from e
        _merge_patch(rec, body)
        if not rec.name:
            raise ValueError("名称不能为空")
        if not rec.datasource_bindings:
            raise ValueError("至少保留一条数据源绑定")
        try:
            _validate_bindings_inputs(
                [
                    DataSetDatasourceBindingInput(
                        datasource_id=b.datasource_id,
                        dependencies=list(b.dependencies),
                        alias=(dict(b.alias) if b.alias else None),
                        date_column=b.date_column,
                        asset_column=b.asset_column,
                    )
                    for b in rec.datasource_bindings
                ]
            )
        except HTTPException as e:
            raise ValueError(_http_error_detail(e)) from e
        for b in rec.datasource_bindings:
            try:
                _validate_datasource_exists(b.datasource_id)
            except HTTPException as e:
                raise ValueError(_http_error_detail(e)) from e
        rec.updated_at = utc_now_iso()

    rec = DataSetsStore.update_item(data_set_id, _apply)
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return _to_public(rec).model_dump()


@tool(description="删除数据集，成功时返回被删除记录的公开信息；不存在则报错")
def delete_data_set(data_set_id: str) -> dict[str, Any]:
    rec = DataSetsStore.delete_item(data_set_id)
    if rec is None:
        raise ValueError(f"数据集 {data_set_id} 不存在")
    return _to_public(rec).model_dump()


DATA_SET_CHAT_TOOLS = [
    create_data_set,
    get_data_set_detail,
    get_data_set_list,
    update_data_set,
    delete_data_set,
]
