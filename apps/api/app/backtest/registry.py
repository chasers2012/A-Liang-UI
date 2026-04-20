from __future__ import annotations

from sqlmodel import select

from app.backtest.models import BacktestRunRow
from app.persistence.sqlite_db import get_session


class BacktestRunsStore:
    @classmethod
    def append(cls, row: BacktestRunRow) -> BacktestRunRow:
        with get_session() as session:
            session.add(row)
            session.commit()
            session.refresh(row)
            session.expunge(row)
            return row

    @classmethod
    def save(cls, row: BacktestRunRow) -> None:
        with get_session() as session:
            session.merge(row)
            session.commit()

    @classmethod
    def update_item(cls, run_id: str, **updates: object) -> BacktestRunRow | None:
        with get_session() as session:
            row = session.get(BacktestRunRow, run_id)
            if row is None:
                return None
            for key, value in updates.items():
                setattr(row, key, value)
            session.add(row)
            session.commit()
            session.refresh(row)
            session.expunge(row)
            return row

    @classmethod
    def get_item(cls, run_id: str) -> BacktestRunRow | None:
        with get_session() as session:
            return session.get(BacktestRunRow, run_id)

    @classmethod
    def list_items(
        cls,
        *,
        strategy_id: str | None = None,
        status: str | None = None,
        limit: int | None = None,
    ) -> list[BacktestRunRow]:
        stmt = select(BacktestRunRow)
        if strategy_id:
            stmt = stmt.where(BacktestRunRow.strategy_id == strategy_id)
        if status:
            stmt = stmt.where(BacktestRunRow.status == status)
        with get_session() as session:
            rows = list(session.exec(stmt))
        rows = sorted(rows, key=lambda r: r.queued_at, reverse=True)
        if limit is not None and limit > 0:
            rows = rows[:limit]
        return rows

    @classmethod
    def delete_by_id(cls, run_id: str) -> bool:
        with get_session() as session:
            row = session.get(BacktestRunRow, run_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
