"""Per-file registry for evaluation profiles (evaluation/profiles/{id}.json)."""

from __future__ import annotations

from sqlmodel import select

from app.evaluation.profile.models import EvaluationProfileRow
from app.persistence.sqlite_db import get_session


class EvaluationProfilesRegistry:
    """DB-backed registry for evaluation profiles."""

    @classmethod
    def list_all(cls) -> list[EvaluationProfileRow]:
        with get_session() as session:
            return list(session.exec(select(EvaluationProfileRow)))

    @classmethod
    def get_by_id(cls, profile_id: str) -> EvaluationProfileRow | None:
        with get_session() as session:
            return session.get(EvaluationProfileRow, profile_id)

    @classmethod
    def save(cls, row: EvaluationProfileRow) -> None:
        with get_session() as session:
            session.merge(row)
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
