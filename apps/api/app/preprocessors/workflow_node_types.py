from __future__ import annotations

from app.data_set.constants import (
    preprocessing_workflow_io_spec_dict,
)
from app.evaluation.profile.schemas import WorkflowIOSpecPublic

_REGISTERED_PREPROCESSOR_IDS: set[str] = set()
_PREPROCESSING_WORKFLOW_IO_SPEC = WorkflowIOSpecPublic(**preprocessing_workflow_io_spec_dict())


def get_preprocessor_workflow_io_spec() -> WorkflowIOSpecPublic:
    return _PREPROCESSING_WORKFLOW_IO_SPEC
