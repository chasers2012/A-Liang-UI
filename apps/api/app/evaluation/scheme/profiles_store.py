"""Per-file registry for evaluation profiles (evaluation/profiles/{id}.json)."""

from __future__ import annotations

import json
from pathlib import Path

from workspace import ensure_dir, workspace_path

from .profile_schemas import EvaluationProfileRecord

PROFILES_DIR = "evaluation/profiles"


class EvaluationProfilesRegistry:
    """Load/save/delete profile JSON files under ``evaluation/profiles/``."""

    @classmethod
    def _profiles_dir(cls) -> Path:
        return ensure_dir(PROFILES_DIR)

    @classmethod
    def _profile_path(cls, profile_id: str) -> Path:
        return workspace_path(PROFILES_DIR, f"{profile_id}.json")

    @classmethod
    def _read_record(cls, path: Path) -> EvaluationProfileRecord | None:
        if not path.is_file():
            return None
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return None
        data = json.loads(raw)
        return EvaluationProfileRecord.model_validate(data)

    @classmethod
    def _write_record(cls, rec: EvaluationProfileRecord) -> None:
        path = cls._profile_path(rec.id)
        path.write_text(
            json.dumps(rec.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    @classmethod
    def list_all(cls) -> list[EvaluationProfileRecord]:
        d = cls._profiles_dir()
        records: list[EvaluationProfileRecord] = []
        for p in sorted(d.glob("*.json")):
            rec = cls._read_record(p)
            if rec is not None:
                records.append(rec)
        return records

    @classmethod
    def get_by_id(cls, profile_id: str) -> EvaluationProfileRecord | None:
        return cls._read_record(cls._profile_path(profile_id))

    @classmethod
    def save(cls, rec: EvaluationProfileRecord) -> None:
        cls._write_record(rec)

    @classmethod
    def delete_by_id(cls, profile_id: str) -> bool:
        path = cls._profile_path(profile_id)
        if not path.is_file():
            return False
        path.unlink()
        return True

    @classmethod
    def apply_default_uniqueness(cls, keep_id: str) -> None:
        """Ensure only ``keep_id`` has ``is_default=True``; clear others."""
        d = cls._profiles_dir()
        for p in d.glob("*.json"):
            rec = cls._read_record(p)
            if rec is None or rec.id == keep_id or not rec.is_default:
                continue
            rec.is_default = False
            cls._write_record(rec)
