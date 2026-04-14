from __future__ import annotations

from sqlmodel import select

from app.backtest.schemas import BacktestRunRecord
from app.persistence.models import BacktestRunRow
from app.persistence.sqlite_db import get_session


def _row_to_record(row: BacktestRunRow) -> BacktestRunRecord:
    return BacktestRunRecord(
        id=row.id,
        strategy_id=row.strategy_id,
        data_set_id=row.data_set_id,
        status=row.status,  # type: ignore[arg-type]
        queued_at=row.queued_at,
        start_at=row.start_at,
        end_at=row.end_at,
        params=dict(row.params or {}),
        error=row.error,
        results=row.results,
    )


def _record_to_row(rec: BacktestRunRecord) -> BacktestRunRow:
    return BacktestRunRow(
        id=rec.id,
        strategy_id=rec.strategy_id,
        data_set_id=rec.data_set_id,
        status=str(rec.status),
        queued_at=rec.queued_at,
        start_at=rec.start_at,
        end_at=rec.end_at,
        params=dict(rec.params or {}),
        error=rec.error,
        results=rec.results,
    )


class BacktestRunsStore:
    @classmethod
    def append(cls, rec: BacktestRunRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(rec))
            session.commit()

    @classmethod
    def save(cls, rec: BacktestRunRecord) -> None:
        with get_session() as session:
            session.merge(_record_to_row(rec))
            session.commit()

    @classmethod
    def get_item(cls, run_id: str) -> BacktestRunRecord | None:
        with get_session() as session:
            row = session.get(BacktestRunRow, run_id)
            return _row_to_record(row) if row is not None else None

    @classmethod
    def list_items(
        cls,
        *,
        strategy_id: str | None = None,
        status: str | None = None,
        limit: int | None = None,
    ) -> list[BacktestRunRecord]:
        stmt = select(BacktestRunRow)
        if strategy_id:
            stmt = stmt.where(BacktestRunRow.strategy_id == strategy_id)
        if status:
            stmt = stmt.where(BacktestRunRow.status == status)
        with get_session() as session:
            rows = list(session.exec(stmt))
        records = [_row_to_record(r) for r in rows]
        records = sorted(records, key=lambda r: r.queued_at, reverse=True)
        if limit is not None and limit > 0:
            records = records[:limit]
        return records

    @classmethod
    def delete_by_id(cls, run_id: str) -> bool:
        with get_session() as session:
            row = session.get(BacktestRunRow, run_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
