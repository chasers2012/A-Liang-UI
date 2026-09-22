from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import workflow.node_types as _workflow_node_types

from app.infra.tooling.safe_tool import safe_tool
from app.packages.datasource.schemas import utc_now_iso
from app.packages.evaluation.profile.constants import empty_workflow_template_dict
from app.packages.evaluation.profile.models import EvaluationProfileRow
from app.packages.evaluation.profile.redistry import EvaluationProfilesRegistry
from app.packages.evaluation.profile.schemas import (
    EvaluationProfileCreate,
    EvaluationProfilePatch,
    EvaluationProfilePublic,
    workflow_public_dict,
)
from app.packages.tool.models import ToolAuthorization


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


@safe_tool("get_evaluation_profile_workflow_template", parse_docstring=True)
def get_evaluation_profile_workflow_template() -> str:
    """
    获取评价方案工作流模板。

    返回空模板（含 nodes/links/workflow_inputs/workflow_outputs），用于创建前初始化。

    Returns:
        空模板 JSON 字符串。
    """
    return json.dumps(empty_workflow_template_dict(), ensure_ascii=False)


@safe_tool("get_workflow_node_types_source", parse_docstring=True)
def get_workflow_node_types_source() -> str:
    """
    获取工作流节点类型源码。

    读取运行环境中的 `node_types` 源码，用于确认 Node/Socket/NodeParam 等结构定义。

    Returns:
        `workflow.node_types` 源码文本。
    """
    path = Path(_workflow_node_types.__file__).resolve()
    return path.read_text(encoding="utf-8")


@safe_tool("create_evaluation_profile", parse_docstring=True)
def create_evaluation_profile(body: EvaluationProfileCreate) -> dict[str, Any]:
    """
    创建并保存评价方案。

    入参 `body` 至少包含 name；workflow 为空时自动使用空模板并返回完整详情。

    Args:
        body: 评价方案创建请求体。

    Returns:
        创建后的评价方案公开信息（包含 workflow）。
    """
    row = body.to_row()
    EvaluationProfilesRegistry.save(row)
    return _to_public(row).model_dump()


@safe_tool("get_evaluation_profile_detail", parse_docstring=True)
def get_evaluation_profile_detail(profile_id: str) -> dict[str, Any]:
    """
    查询评价方案详情。

    Args:
        profile_id: 评价方案 ID。

    Returns:
        评价方案公开信息（包含 workflow）。
    """
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    return _to_public(row).model_dump()


@safe_tool("get_evaluation_profile_list", parse_docstring=True)
def get_evaluation_profile_list() -> list[dict[str, Any]]:
    """
    查询评价方案列表。

    Returns:
        所有方案摘要列表，供运行与编辑流程选择。
    """
    return [_to_public(i).model_dump() for i in EvaluationProfilesRegistry.list_all()]


@safe_tool("update_evaluation_profile", parse_docstring=True)
def update_evaluation_profile(profile_id: str, body: EvaluationProfilePatch) -> dict[str, Any]:
    """
    更新评价方案配置。

    Args:
        profile_id: 评价方案 ID。
        body: 更新内容（`EvaluationProfilePatch`）。

    Returns:
        更新后的评价方案公开信息。
    """
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    data = body.model_dump(exclude_unset=True)
    _merge_evaluation_profile_patch(row, body, data)
    EvaluationProfilesRegistry.save(row)
    return _to_public(row).model_dump()


@safe_tool("delete_evaluation_profile", parse_docstring=True)
def delete_evaluation_profile(profile_id: str) -> dict[str, Any]:
    """
    删除指定评价方案。

    Args:
        profile_id: 评价方案 ID。

    Returns:
        删除前快照（公开信息）。
    """
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    public = _to_public(row).model_dump()
    if not EvaluationProfilesRegistry.delete_by_id(profile_id):
        raise ValueError(f"评价方案 {profile_id} 不存在")
    return public


TOOLS = {
    "evaluation_profile.get_evaluation_profile_workflow_template": (
        get_evaluation_profile_workflow_template,
        ToolAuthorization.allowed,
    ),
    "evaluation_profile.get_workflow_node_types_source": (
        get_workflow_node_types_source,
        ToolAuthorization.allowed,
    ),
    "evaluation_profile.create_evaluation_profile": (
        create_evaluation_profile,
        ToolAuthorization.allowed,
    ),
    "evaluation_profile.get_evaluation_profile_detail": (
        get_evaluation_profile_detail,
        ToolAuthorization.allowed,
    ),
    "evaluation_profile.get_evaluation_profile_list": (
        get_evaluation_profile_list,
        ToolAuthorization.allowed,
    ),
    "evaluation_profile.update_evaluation_profile": (
        update_evaluation_profile,
        ToolAuthorization.need_authorize,
    ),
    "evaluation_profile.delete_evaluation_profile": (
        delete_evaluation_profile,
        ToolAuthorization.disabled,
    ),
}
