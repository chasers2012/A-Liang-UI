from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.datasources.schemas import utc_now_iso
from app.evaluation.scheme.profile_node_types import list_evaluation_profile_node_types_public
from app.evaluation.scheme.profile_schemas import (
    EvaluationNodeTypePublic,
    EvaluationProfileCreate,
    EvaluationProfilePatch,
    EvaluationProfilePublic,
    EvaluationProfileRecord,
)
from app.evaluation.scheme.profiles_store import EvaluationProfilesRegistry

router = APIRouter(prefix="/evaluation-profiles", tags=["evaluation-profiles"])


def _to_public(rec: EvaluationProfileRecord) -> EvaluationProfilePublic:
    return EvaluationProfilePublic(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        data_set_id=rec.data_set_id,
        workflow=rec.workflow,
        is_default=rec.is_default,
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
            raise HTTPException(status_code=400, detail="name 不能为空")
        rec.name = str(body.name).strip()
    if "description" in data:
        rec.description = (body.description or "").strip()
    if "data_set_id" in data:
        tid = (body.data_set_id or "").strip() if body.data_set_id is not None else ""
        rec.data_set_id = tid or None
    if "workflow" in data and body.workflow is not None:
        rec.workflow = body.workflow
    if "is_default" in data and body.is_default is not None:
        rec.is_default = body.is_default
    rec.updated_at = utc_now_iso()


@router.get("/node-types", response_model=list[EvaluationNodeTypePublic])
def list_node_types() -> list[EvaluationNodeTypePublic]:
    return list_evaluation_profile_node_types_public()


@router.get("", response_model=list[EvaluationProfilePublic])
def list_evaluation_profiles() -> list[EvaluationProfilePublic]:
    return [_to_public(i) for i in EvaluationProfilesRegistry.list_all()]


@router.get("/{profile_id}", response_model=EvaluationProfilePublic)
def get_evaluation_profile(profile_id: str) -> EvaluationProfilePublic:
    rec = EvaluationProfilesRegistry.get_by_id(profile_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价方案不存在")
    return _to_public(rec)


@router.post("", response_model=EvaluationProfilePublic)
def create_evaluation_profile(body: EvaluationProfileCreate) -> EvaluationProfilePublic:
    rec = body.to_record()
    EvaluationProfilesRegistry.save(rec)
    if rec.is_default:
        EvaluationProfilesRegistry.apply_default_uniqueness(rec.id)
    return _to_public(rec)


@router.patch("/{profile_id}", response_model=EvaluationProfilePublic)
def patch_evaluation_profile(
    profile_id: str, body: EvaluationProfilePatch
) -> EvaluationProfilePublic:
    rec = EvaluationProfilesRegistry.get_by_id(profile_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="评价方案不存在")

    data = body.model_dump(exclude_unset=True)
    _merge_evaluation_profile_patch(rec, body, data)
    EvaluationProfilesRegistry.save(rec)
    if rec.is_default:
        EvaluationProfilesRegistry.apply_default_uniqueness(rec.id)
    return _to_public(rec)


@router.delete("/{profile_id}", status_code=204)
def delete_evaluation_profile(profile_id: str) -> None:
    if not EvaluationProfilesRegistry.delete_by_id(profile_id):
        raise HTTPException(status_code=404, detail="评价方案不存在")
