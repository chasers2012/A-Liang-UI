from __future__ import annotations

import json
import os
from pathlib import Path

from app.datasource.schemas import utc_now_iso
from app.evaluation.profile.redistry import EvaluationProfilesRegistry
from app.evaluation.profile.schemas import EvaluationProfileRecord


def _examples_dir() -> Path:
    return Path(__file__).resolve().parent / "examples"


def _display_name_from_stem(stem: str) -> str:
    return stem.replace("_", " ").strip() or stem


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def seed_evaluation_profile_examples() -> None:
    examples_dir = _examples_dir()
    if not examples_dir.is_dir():
        return

    overwrite = _is_truthy(os.getenv("EVALUATION_PROFILE_SEED_OVERWRITE", "false"))
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

        record = EvaluationProfileRecord(
            id=profile_id,
            name=_display_name_from_stem(path.stem),
            description=f"Seeded from {path.name}",
            workflow=json.dumps(workflow_obj, ensure_ascii=False),
            created_at=(existing.created_at if existing is not None else now),
            updated_at=now,
        )
        EvaluationProfilesRegistry.save(record)
