from __future__ import annotations

from app.evaluation.profile.constants import evaluation_workflow_io_spec_dict
from app.evaluation.profile.schemas import WorkflowIOSpecPublic


class ProfileNotFoundError(LookupError):
    def __init__(self, profile_id: str) -> None:
        self.profile_id = profile_id
        super().__init__(profile_id)


class FactorNotFoundError(LookupError):
    def __init__(self, factor_id: str) -> None:
        self.factor_id = factor_id
        super().__init__(factor_id)


def get_evaluation_profile_workflow_io_spec() -> WorkflowIOSpecPublic:
    return WorkflowIOSpecPublic(**evaluation_workflow_io_spec_dict())
