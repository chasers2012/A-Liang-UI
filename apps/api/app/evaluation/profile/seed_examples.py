from __future__ import annotations

import json
import os
from pathlib import Path

from workflow.schemas import WorkflowGraphPersisted

from app.common.env import is_truthy
from app.datasource.schemas import utc_now_iso
from app.evaluation.profile.models import EvaluationProfileRow
from app.evaluation.profile.redistry import EvaluationProfilesRegistry


def _examples_dir() -> Path:
    return Path(__file__).resolve().parent / "examples"


def _display_name_from_stem(stem: str) -> str:
    return stem.replace("_", " ").strip() or stem


def seed_evaluation_profile_examples() -> None:
    examples_dir = _examples_dir()
    if not examples_dir.is_dir():
        return

    overwrite = is_truthy(os.getenv("OVERWRITE_EXAMPLES", "false"))
    now = utc_now_iso()
    for path in sorted(examples_dir.glob("*.json")):
        try:
            workflow_obj = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(workflow_obj, dict):
            continue

        # Use filename as stable profile id so startup seeding is idempotent.
        profile_id = path.stem
        existing = EvaluationProfilesRegistry.get_by_id(profile_id)
        if existing is not None and not overwrite:
            continue

        row = EvaluationProfileRow(
            id=profile_id,
            name=_display_name_from_stem(path.stem),
            description=f"Seeded from {path.name}",
            workflow=json.dumps(
                WorkflowGraphPersisted.model_validate(workflow_obj).model_dump(by_alias=True),
                ensure_ascii=False,
            ),
            created_at=(existing.created_at if existing is not None else now),
            updated_at=now,
        )
        EvaluationProfilesRegistry.save(row)
