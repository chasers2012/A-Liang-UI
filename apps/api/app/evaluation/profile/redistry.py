"""Per-file registry for evaluation profiles (evaluation/profiles/{id}.json)."""

from __future__ import annotations

from sqlmodel import select

from app.persistence.models import EvaluationProfileRow
from app.persistence.sqlite_db import get_session

from .schemas import EvaluationProfileRecord


class EvaluationProfilesRegistry:
    """DB-backed registry for evaluation profiles."""

    @staticmethod
    def _row_to_record(row: EvaluationProfileRow) -> EvaluationProfileRecord:
        return EvaluationProfileRecord(
            id=row.id,
            name=row.name,
            description=row.description,
            workflow=row.workflow,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _record_to_row(rec: EvaluationProfileRecord) -> EvaluationProfileRow:
        return EvaluationProfileRow(
            id=rec.id,
            name=rec.name,
            description=rec.description,
            workflow=rec.workflow,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
        )

    @classmethod
    def list_all(cls) -> list[EvaluationProfileRecord]:
        with get_session() as session:
            rows = list(session.exec(select(EvaluationProfileRow)))
        return [cls._row_to_record(r) for r in rows]

    @classmethod
    def get_by_id(cls, profile_id: str) -> EvaluationProfileRecord | None:
        with get_session() as session:
            row = session.get(EvaluationProfileRow, profile_id)
            return cls._row_to_record(row) if row is not None else None

    @classmethod
    def save(cls, rec: EvaluationProfileRecord) -> None:
        with get_session() as session:
            session.merge(cls._record_to_row(rec))
            session.commit()

    @classmethod
    def delete_by_id(cls, profile_id: str) -> bool:
        with get_session() as session:
            row = session.get(EvaluationProfileRow, profile_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
