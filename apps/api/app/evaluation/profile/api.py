from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from app.datasource.schemas import utc_now_iso
from app.evaluation.profile.constants import empty_workflow_template_dict
from app.evaluation.profile.controller import (
    get_evaluation_profile_workflow_io_spec,
)
from app.evaluation.profile.models import EvaluationProfileRow
from app.evaluation.profile.redistry import EvaluationProfilesRegistry
from app.evaluation.profile.schemas import (
    EvaluationProfileCreate,
    EvaluationProfilePatch,
    EvaluationProfilePublic,
    WorkflowIOSpecPublic,
    workflow_public_dict,
)

router = APIRouter(prefix="/evaluation-profiles", tags=["evaluation-profiles"])


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
            raise HTTPException(status_code=400, detail="name 不能为空")
        row.name = str(body.name).strip()
    if "description" in data:
        row.description = (body.description or "").strip()
    if "workflow" in data and body.workflow is not None:
        row.workflow = json.dumps(body.workflow, ensure_ascii=False)
    row.updated_at = utc_now_iso()


@router.get("/workflow-io", response_model=WorkflowIOSpecPublic)
def get_workflow_io() -> WorkflowIOSpecPublic:
    return get_evaluation_profile_workflow_io_spec()


@router.get("/workflow-template", response_model=dict)
def get_workflow_template() -> dict:
    return empty_workflow_template_dict()


@router.get("", response_model=list[EvaluationProfilePublic])
def list_evaluation_profiles() -> list[EvaluationProfilePublic]:
    return [_to_public(i) for i in EvaluationProfilesRegistry.list_all()]


@router.get("/{profile_id}", response_model=EvaluationProfilePublic)
def get_evaluation_profile(profile_id: str) -> EvaluationProfilePublic:
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="评价方案不存在")
    return _to_public(row)


@router.post("", response_model=EvaluationProfilePublic)
def create_evaluation_profile(body: EvaluationProfileCreate) -> EvaluationProfilePublic:
    row = body.to_row()
    EvaluationProfilesRegistry.save(row)
    return _to_public(row)


@router.patch("/{profile_id}", response_model=EvaluationProfilePublic)
def patch_evaluation_profile(
    profile_id: str, body: EvaluationProfilePatch
) -> EvaluationProfilePublic:
    row = EvaluationProfilesRegistry.get_by_id(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="评价方案不存在")

    data = body.model_dump(exclude_unset=True)
    _merge_evaluation_profile_patch(row, body, data)
    EvaluationProfilesRegistry.save(row)
    return _to_public(row)


@router.delete("/{profile_id}", status_code=204)
def delete_evaluation_profile(profile_id: str) -> None:
    if not EvaluationProfilesRegistry.delete_by_id(profile_id):
        raise HTTPException(status_code=404, detail="评价方案不存在")
