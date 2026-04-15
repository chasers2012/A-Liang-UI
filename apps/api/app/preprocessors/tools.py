from __future__ import annotations

from typing import Any

from langchain_core.tools import tool

from app.common.datetime_utils import utc_now_iso
from app.preprocessors.constants import DEFAULT_PREPROCESSOR_SOURCE
from app.preprocessors.controller import (
    apply_preprocessor_patch,
    get_preprocessor_record,
    list_preprocessor_records,
    load_preprocessor,
    load_preprocessor_detail,
    sync_preprocessor_metadata_from_source,
    update_preprocessor_record,
    write_preprocessor_source,
)
from app.preprocessors.controller import (
    create_preprocessor as create_preprocessor_controller,
)
from app.preprocessors.controller import (
    delete_preprocessor as delete_preprocessor_controller,
)
from app.preprocessors.schemas import PreprocessorCreate, PreprocessorPatch


@tool(description="获取预处理器源码模板（DEFAULT_PREPROCESSOR_SOURCE）。")
def get_new_preprocessor_template() -> str:
    return DEFAULT_PREPROCESSOR_SOURCE


@tool(
    description=(
        "创建预处理器并持久化。"
        "入参 body 可提供 source（完整 Python 源码）；为空时自动使用内置模板。"
        "返回创建后的预处理器详情。"
    )
)
def create_preprocessor(body: dict[str, Any]) -> dict[str, Any]:
    src = (body.get("source") or "").strip()
    if not src:
        src = DEFAULT_PREPROCESSOR_SOURCE.strip()
    try:
        create_body = PreprocessorCreate(source=src)
        rec = create_preprocessor_controller(create_body)
    except ValueError as e:
        raise ValueError(str(e)) from e

    loaded = load_preprocessor(rec.id)
    if loaded is None:
        raise ValueError(f"预处理器 {rec.id} 创建后加载失败")
    return loaded.model_dump()


@tool(description="按 preprocessor_id 查询预处理器详情（含完整 source）；不存在时报错。")
def get_preprocessor_detail(preprocessor_id: str) -> dict[str, Any]:
    detail = load_preprocessor_detail(preprocessor_id)
    if detail is None:
        raise ValueError(f"预处理器 {preprocessor_id} 不存在")
    return detail.model_dump()


@tool(description="获取预处理器列表。")
def get_preprocessor_list() -> list[dict[str, Any]]:
    return [
        x.model_dump()
        for rec in list_preprocessor_records()
        if (x := load_preprocessor(rec.id)) is not None
    ]


@tool(description="更新预处理器并返回更新后的详情；支持更新 metadata 与 source。")
def update_preprocessor(preprocessor_id: str, body: PreprocessorPatch) -> dict[str, Any]:
    unset = body.model_dump(exclude_unset=True)

    def _apply(rec) -> None:
        apply_preprocessor_patch(rec, body)
        if "source" in unset and body.source is not None:
            write_preprocessor_source(rec, body.source)
            sync_preprocessor_metadata_from_source(rec)
        rec.updated_at = utc_now_iso()

    rec = update_preprocessor_record(preprocessor_id, _apply)
    if rec is None:
        raise ValueError(f"预处理器 {preprocessor_id} 不存在")
    loaded = load_preprocessor(rec.id)
    if loaded is None:
        raise ValueError(f"预处理器 {preprocessor_id} 不存在")
    return loaded.model_dump()


@tool(description="删除预处理器并返回删除记录；不存在时报错。")
def delete_preprocessor(preprocessor_id: str) -> dict[str, Any]:
    rec = get_preprocessor_record(preprocessor_id)
    if rec is None:
        raise ValueError(f"预处理器 {preprocessor_id} 不存在")
    deleted = delete_preprocessor_controller(preprocessor_id)
    if deleted is None:
        raise ValueError(f"预处理器 {preprocessor_id} 不存在")
    return deleted.model_dump()


PREPROCESSOR_CHAT_TOOLS = [
    get_new_preprocessor_template,
    create_preprocessor,
    get_preprocessor_detail,
    get_preprocessor_list,
    update_preprocessor,
    delete_preprocessor,
]
