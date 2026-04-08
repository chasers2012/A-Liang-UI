from __future__ import annotations

from sqlmodel import select

from app.evaluation.run.schemas import EvaluationRunRecord
from app.persistence.models import EvaluationRunRow
from app.persistence.sqlite_db import get_session


def _row_to_record(row: EvaluationRunRow) -> EvaluationRunRecord:
    return EvaluationRunRecord(
        id=row.id,
        start_at=row.start_at,
        end_at=row.end_at,
        factor_id=row.factor_id,
        error=row.error,
        evaluation_profile_id=row.evaluation_profile_id,
        results=row.results,
    )


def _record_to_row(rec: EvaluationRunRecord) -> EvaluationRunRow:
    return EvaluationRunRow(
        id=rec.id,
        start_at=rec.start_at,
        end_at=rec.end_at,
        factor_id=rec.factor_id,
        error=rec.error,
        evaluation_profile_id=rec.evaluation_profile_id,
        results=rec.results,
    )


class EvaluationRunsStore:
    """SQLite table `evaluation_runs` (all runs history)."""

    @classmethod
    def get_by_factor_id(cls, factor_id: str) -> EvaluationRunRecord | None:
        return cls.get_latest_by_factor_id(factor_id)

    @classmethod
    def list_by_factor_id(cls, factor_id: str) -> list[EvaluationRunRecord]:
        with get_session() as session:
            rows = list(
                session.exec(
                    select(EvaluationRunRow).where(EvaluationRunRow.factor_id == factor_id)
                )
            )
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_latest_by_factor_id(cls, factor_id: str) -> EvaluationRunRecord | None:
        records = cls.list_by_factor_id(factor_id)
        if not records:
            return None
        return max(records, key=lambda rec: rec.end_at)

    @classmethod
    def append(cls, rec: EvaluationRunRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(rec))
            session.commit()

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
    def list_items(cls) -> list[EvaluationRunRecord]:
        with get_session() as session:
            rows = list(session.exec(select(EvaluationRunRow)))
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, run_id: str) -> EvaluationRunRecord | None:
        with get_session() as session:
            row = session.get(EvaluationRunRow, run_id)
            return _row_to_record(row) if row is not None else None


def delete_evaluation_run_for_factor(factor_id: str) -> None:
    EvaluationRunsStore.delete_for_factor(factor_id)


def delete_evaluation_run_by_id(run_id: str) -> bool:
    return EvaluationRunsStore.delete_by_id(run_id)


def upsert_evaluation_run(rec: EvaluationRunRecord) -> None:
    EvaluationRunsStore.append(rec)
