from __future__ import annotations

import json
from typing import Protocol

from workflow.schemas import WorkflowGraphPersisted

from app.infra.common.datetime_utils import utc_now_iso
from app.infra.common.id import generate_id
from app.packages.evaluation.profile.constants import (
    empty_workflow_template_dict,
    evaluation_workflow_io_spec_dict,
)
from app.packages.evaluation.profile.models import EvaluationProfileRow
from app.packages.evaluation.profile.redistry import EvaluationProfilesRegistry
from app.packages.evaluation.profile.schemas import WorkflowIOSpecPublic


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: str) -> None:
        self.profile_id = profile_id
        super().__init__(profile_id)


class FactorNotFoundError(LookupError):
    def __init__(self, factor_id: str) -> None:
        self.factor_id = factor_id
        super().__init__(factor_id)


class EvaluationProfileWorkflowSpecLike(Protocol):
    name: str
    description: str
    workflow: dict | None


def register_plugin_evaluation_profile_workflow(
    workflow_spec: EvaluationProfileWorkflowSpecLike,
) -> None:
    profile_name = str(workflow_spec.name).strip()
    if not profile_name:
        raise ValueError("plugin evaluation profile name cannot be empty")
    profile_id = generate_id("evaluation-profiles", profile_name)

    raw_workflow = (
        workflow_spec.workflow
        if workflow_spec.workflow is not None
        else empty_workflow_template_dict()
    )
    validated_workflow = WorkflowGraphPersisted.model_validate(raw_workflow).model_dump(
        by_alias=True
    )

    now = utc_now_iso()
    existed = EvaluationProfilesRegistry.get_by_id(profile_id)
    row = EvaluationProfileRow(
        id=profile_id,
        name=profile_name,
        description=(workflow_spec.description or "").strip(),
        workflow=json.dumps(validated_workflow, ensure_ascii=False),
        created_at=existed.created_at if existed is not None else now,
        updated_at=now,
    )
    EvaluationProfilesRegistry.save(row)


def get_evaluation_profile_workflow_io_spec() -> WorkflowIOSpecPublic:
    return WorkflowIOSpecPublic(**evaluation_workflow_io_spec_dict())
