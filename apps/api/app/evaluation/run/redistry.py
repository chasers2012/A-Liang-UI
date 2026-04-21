from __future__ import annotations

from sqlmodel import select

from app.evaluation.run.models import EvaluationRunRow
from app.persistence.sqlite_db import get_session


class EvaluationRunsStore:
    """SQLite table `evaluation_runs` (all runs history)."""

    @classmethod
    def get_by_factor_id(cls, factor_id: str) -> EvaluationRunRow | None:
        return cls.get_latest_by_factor_id(factor_id)

    @classmethod
    def list_by_factor_id(cls, factor_id: str) -> list[EvaluationRunRow]:
        with get_session() as session:
            return list(
                session.exec(
                    select(EvaluationRunRow).where(EvaluationRunRow.factor_id == factor_id)
                )
            )

    @classmethod
    def get_latest_by_factor_id(cls, factor_id: str) -> EvaluationRunRow | None:
        rows = cls.list_by_factor_id(factor_id)
        if not rows:
            return None
        return max(rows, key=lambda row: row.end_at)

    @classmethod
    def append(cls, row: EvaluationRunRow) -> None:
        with get_session() as session:
            session.add(row)
            session.commit()
            # After commit, attributes expire by default; refresh while the session
            # is still open so callers can use the same instance outside this block.
            session.refresh(row)

    @classmethod
    def delete_by_id(cls, run_id: str) -> bool:
        with get_session() as session:
            row = session.get(EvaluationRunRow, run_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True

    @classmethod
    def delete_for_factor(cls, factor_id: str) -> None:
        with get_session() as session:
            rows = list(
                session.exec(
                    select(EvaluationRunRow).where(EvaluationRunRow.factor_id == factor_id)
                )
            )
            for row in rows:
                session.delete(row)
            session.commit()

    @classmethod
    def list_items(cls) -> list[EvaluationRunRow]:
        with get_session() as session:
            return list(session.exec(select(EvaluationRunRow)))

    @classmethod
    def get_item(cls, run_id: str) -> EvaluationRunRow | None:
        with get_session() as session:
            return session.get(EvaluationRunRow, run_id)


def delete_evaluation_run_for_factor(factor_id: str) -> None:
    EvaluationRunsStore.delete_for_factor(factor_id)


def delete_evaluation_run_by_id(run_id: str) -> bool:
    return EvaluationRunsStore.delete_by_id(run_id)


def upsert_evaluation_run(row: EvaluationRunRow) -> None:
    EvaluationRunsStore.append(row)
