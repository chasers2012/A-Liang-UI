"""Per-file registry for evaluation profiles (evaluation/profiles/{id}.json)."""

from __future__ import annotations

import json
from pathlib import Path

from workspace import ensure_dir, workspace_path

from app.evaluation_run.schemas import FactorEvaluationRowPublic
from app.evaluation_run.service import execute_and_persist_factor_evaluation_run
from app.factors.registry import FactorItemsRegistry

from .schemas import EvaluationProfileRecord

PROFILES_DIR = "evaluation/profiles"


class ProfileNotFoundError(LookupError):
    """No evaluation profile JSON for ``profile_id``."""

    def __init__(self, profile_id: str) -> None:
        self.profile_id = profile_id
        super().__init__(profile_id)


class FactorNotFoundError(LookupError):
    """No factor registry record for ``factor_id``."""

    def __init__(self, factor_id: str) -> None:
        self.factor_id = factor_id
        super().__init__(factor_id)


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
    def run_factor_evaluation(cls, profile_id: str, factor_id: str) -> FactorEvaluationRowPublic:
        prof = cls.get_by_id(profile_id)
        if prof is None:
            raise ProfileNotFoundError(profile_id)
        rec = FactorItemsRegistry.get_item(factor_id)
        if rec is None:
            raise FactorNotFoundError(factor_id)
        eval_rec = execute_and_persist_factor_evaluation_run(
            factor_id,
            evaluation_profile=prof,
        )
        err_raw = (eval_rec.error or "").strip()
        err: str | None = err_raw or None
        return FactorEvaluationRowPublic(
            factor_id=factor_id,
            name=rec.name,
            has_evaluation=True,
            evaluated_at=eval_rec.evaluated_at,
            error=err,
            evaluation_profile_id=eval_rec.evaluation_profile_id,
            results=eval_rec.results,
        )
