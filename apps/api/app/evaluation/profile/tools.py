from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import workflow.node_types as _workflow_node_types
from langchain_core.tools import tool

from app.datasource.schemas import utc_now_iso
from app.evaluation.profile.constants import empty_workflow_template_dict
from app.evaluation.profile.models import EvaluationProfileRow
from app.evaluation.profile.redistry import EvaluationProfilesRegistry
from app.evaluation.profile.schemas import (
    EvaluationProfileCreate,
    EvaluationProfilePatch,
    EvaluationProfilePublic,
    workflow_public_dict,
)


def _to_public(row: EvaluationProfileRow) -> EvaluationProfilePublic:
    return EvaluationProfilePublic(
        id=row.id,
        name=row.name,
        description=row.description,
        workflow=workflow_public_dict(row.workflow),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _merge_evaluation_profile_patch(
    row: EvaluationProfileRow,
    body: EvaluationProfilePatch,
    data: dict[str, object],
) -> None:
    if "name" in data:
        if body.name is None or not str(body.name).strip():
            raise ValueError("name 不能为空")
        row.name = str(body.name).strip()
    if "description" in data:
        row.description = (body.description or "").strip()
    if "workflow" in data and body.workflow is not None:
        row.workflow = json.dumps(body.workflow, ensure_ascii=False)
    row.updated_at = utc_now_iso()


@tool(
    "获取评价方案工作流模板",
    description=(
        "获取空评价方案工作流 JSON 模板（含 nodes/links/workflow_inputs/workflow_outputs）。"
        "通常先基于模板编辑图结构，再调用 create_evaluation_profile 保存。"
    ),
)
def get_evaluation_profile_workflow_template() -> str:
    return json.dumps(empty_workflow_template_dict(), ensure_ascii=False)


@tool(
    "获取工作流节点类型源码",
    description=(
        "读取 workflow 包中 node_types 模块的完整源码（与当前运行环境一致）。"
        "用于查看 Node/Socket/NodeParam 等类型定义，帮助正确编写评价工作流节点。"
    ),
)
def get_workflow_node_types_source() -> str:
    path = Path(_workflow_node_types.__file__).resolve()
    return path.read_text(encoding="utf-8")


@tool(
    "创建评价方案",
    description=(
        "创建评价方案并持久化。"
        "入参 body 必须包含 name；workflow 为空时自动使用空模板。"
        "返回创建后的评价方案详情（含 workflow 对象）。"
    ),
)
def create_evaluation_profile(body: EvaluationProfileCreate) -> dict[str, Any]:
    row = body.to_row()
    EvaluationProfilesRegistry.save(row)
    return _to_public(row).model_dump()


@tool(
    "获取评价方案详情", description="按 profile_id 查询评价方案详情（含 workflow）；不存在时报错。"
)
def get_evaluation_profile_detail(profile_id: str) -> dict[str, Any]:
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    return _to_public(row).model_dump()


@tool("获取评价方案列表", description="获取评价方案列表。")
def get_evaluation_profile_list() -> list[dict[str, Any]]:
    return [_to_public(i).model_dump() for i in EvaluationProfilesRegistry.list_all()]


@tool("更新评价方案", description="更新评价方案并返回更新后的详情（含 workflow）；不存在时报错。")
def update_evaluation_profile(profile_id: str, body: EvaluationProfilePatch) -> dict[str, Any]:
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    data = body.model_dump(exclude_unset=True)
    _merge_evaluation_profile_patch(row, body, data)
    EvaluationProfilesRegistry.save(row)
    return _to_public(row).model_dump()


@tool("删除评价方案", description="删除评价方案并返回删除前快照；不存在时报错。")
def delete_evaluation_profile(profile_id: str) -> dict[str, Any]:
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    public = _to_public(row).model_dump()
    if not EvaluationProfilesRegistry.delete_by_id(profile_id):
        raise ValueError(f"评价方案 {profile_id} 不存在")
    return public


EVALUATION_SCHEME_CHAT_TOOLS = [
    get_evaluation_profile_workflow_template,
    get_workflow_node_types_source,
    create_evaluation_profile,
    get_evaluation_profile_detail,
    get_evaluation_profile_list,
    update_evaluation_profile,
    delete_evaluation_profile,
]
