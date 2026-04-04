from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import workflow.node_types as _workflow_node_types
from langchain_core.tools import tool

from app.datasources.schemas import utc_now_iso
from app.evaluation.profile.profile_node_types import list_evaluation_profile_node_types_public
from app.evaluation.profile.profile_schemas import (
    EvaluationProfileCreate,
    EvaluationProfilePatch,
    EvaluationProfilePublic,
    EvaluationProfileRecord,
    workflow_public_dict,
)
from app.evaluation.profile.profiles_store import (
    EvaluationProfilesRegistry,
    FactorNotFoundError,
    ProfileNotFoundError,
)

_EMPTY_WORKFLOW_JSON = json.dumps(
    {"nodes": [], "links": [], "viewport": None},
    ensure_ascii=False,
)


def _to_public(rec: EvaluationProfileRecord) -> EvaluationProfilePublic:
    return EvaluationProfilePublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        workflow=workflow_public_dict(rec.workflow),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


def _merge_evaluation_profile_patch(
    rec: EvaluationProfileRecord,
    body: EvaluationProfilePatch,
    data: dict[str, object],
) -> None:
    if "name" in data:
        if body.name is None or not str(body.name).strip():
            raise ValueError("name 不能为空")
        rec.name = str(body.name).strip()
    if "description" in data:
        rec.description = (body.description or "").strip()
    if "workflow" in data and body.workflow is not None:
        rec.workflow = json.dumps(body.workflow, ensure_ascii=False)
    rec.updated_at = utc_now_iso()


@tool(
    description=(
        "获取空评价方案工作流 JSON 模板（nodes/links/viewport）。"
        "可先调用本工具拿到结构，再编辑节点与连线；"
        "最后用 create_evaluation_profile(body={name, description?, workflow?}) 保存。"
    )
)
def get_evaluation_profile_workflow_template() -> str:
    return _EMPTY_WORKFLOW_JSON


@tool(
    description=(
        "列出评价方案工作流可用的节点类型（内置节点与各评价指标节点），"
        "含 type、label、inputs、outputs 等，用于拼装 workflow.nodes。"
    )
)
def list_evaluation_profile_node_types() -> list[dict[str, Any]]:
    return [n.model_dump() for n in list_evaluation_profile_node_types_public()]


@tool(
    description=(
        "读取 workflow 库中 node_types 模块的完整 Python 源码（与运行环境安装的 workflow 包一致）。"
        "内容包含 Socket、NodeParam 及其子类、Node、NodeParamModel、validate_node_param_list 等类型定义，"
        "用于正确编写评价工作流节点与理解 inputs/outputs/params 的序列化形状。"
    )
)
def get_workflow_node_types_source() -> str:
    path = Path(_workflow_node_types.__file__).resolve()
    return path.read_text(encoding="utf-8")


@tool(
    description=(
        "创建并保存一个评价方案（evaluation profile），返回所创建方案的详情（含 workflow 对象）。"
        "入参 body 必须包含 name；workflow 可为空对象，缺省则使用空图。"
    )
)
def create_evaluation_profile(body: EvaluationProfileCreate) -> dict[str, Any]:
    rec = body.to_record()
    EvaluationProfilesRegistry.save(rec)
    return _to_public(rec).model_dump()


@tool(description="获取评价方案详情，返回所获取方案的详情（含 workflow 对象）")
def get_evaluation_profile_detail(profile_id: str) -> dict[str, Any]:
    rec = EvaluationProfilesRegistry.get_by_id(profile_id)
    if rec is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    return _to_public(rec).model_dump()


@tool(description="获取评价方案列表，返回所获取方案的详情列表")
def get_evaluation_profile_list() -> list[dict[str, Any]]:
    return [_to_public(i).model_dump() for i in EvaluationProfilesRegistry.list_all()]


@tool(description="更新评价方案，返回所更新方案的详情（含 workflow 对象）")
def update_evaluation_profile(profile_id: str, body: EvaluationProfilePatch) -> dict[str, Any]:
    rec = EvaluationProfilesRegistry.get_by_id(profile_id)
    if rec is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    data = body.model_dump(exclude_unset=True)
    _merge_evaluation_profile_patch(rec, body, data)
    EvaluationProfilesRegistry.save(rec)
    return _to_public(rec).model_dump()


@tool(description="删除评价方案，返回被删除方案的详情（删除前快照）")
def delete_evaluation_profile(profile_id: str) -> dict[str, Any]:
    rec = EvaluationProfilesRegistry.get_by_id(profile_id)
    if rec is None:
        raise ValueError(f"评价方案 {profile_id} 不存在")
    public = _to_public(rec).model_dump()
    if not EvaluationProfilesRegistry.delete_by_id(profile_id):
        raise ValueError(f"评价方案 {profile_id} 不存在")
    return public


@tool(
    description=(
        "对指定因子执行一次评价方案工作流并写入最新评价结果（与 API "
        "POST /evaluation-profiles/{profile_id}/factors/{factor_id}/evaluations/run 一致）。"
        "入参 profile_id 为评价方案 id，factor_id 为因子 id；"
        "返回字典含 factor_id、name、has_evaluation、evaluated_at、error、evaluation_profile_id、results。"
    )
)
def run_factor_evaluation(profile_id: str, factor_id: str) -> dict[str, Any]:
    try:
        row = EvaluationProfilesRegistry.run_factor_evaluation(profile_id, factor_id)
    except ProfileNotFoundError:
        raise ValueError(f"评价方案 {profile_id} 不存在") from None
    except FactorNotFoundError:
        raise ValueError(f"因子 {factor_id} 不存在") from None
    return row.model_dump()


EVALUATION_SCHEME_CHAT_TOOLS = [
    get_evaluation_profile_workflow_template,
    list_evaluation_profile_node_types,
    get_workflow_node_types_source,
    create_evaluation_profile,
    get_evaluation_profile_detail,
    get_evaluation_profile_list,
    update_evaluation_profile,
    delete_evaluation_profile,
    run_factor_evaluation,
]
