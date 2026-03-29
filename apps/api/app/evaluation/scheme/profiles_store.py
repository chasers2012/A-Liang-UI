from __future__ import annotations

from typing import Any

from app.persistence import registry_helpers
from app.persistence.registry_helpers import get_first_default_item
from app.persistence.workspace_registry import WorkspaceItemsRegistry

from .profile_schemas import EvaluationProfileRecord, EvaluationProfilesFile

apply_default_uniqueness = registry_helpers.apply_default_uniqueness

REGISTRY_FILENAME = "evaluation_profiles.json"


class EvaluationProfilesRegistry(
    WorkspaceItemsRegistry[EvaluationProfileRecord, EvaluationProfilesFile]
):
    filename = REGISTRY_FILENAME
    file_model = EvaluationProfilesFile

    @classmethod
    def save_model_dump_kwargs(cls) -> dict[str, Any] | None:
        return {"mode": "json"}

    @classmethod
    def get_default_profile(cls, reg: EvaluationProfilesFile) -> EvaluationProfileRecord | None:
        return get_first_default_item(reg.items)
