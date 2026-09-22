from __future__ import annotations

from sqlalchemy import func
from sqlmodel import select

from app.infra.persistence.sqlite_db import get_session

from .models import BacktestRunRow


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
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[int, list[BacktestRunRow]]:
        stmt = select(BacktestRunRow)
        if strategy_id:
            stmt = stmt.where(BacktestRunRow.strategy_id == strategy_id)
        if status:
            stmt = stmt.where(BacktestRunRow.status == status)
        stmt = stmt.order_by(BacktestRunRow.queued_at.desc())

        count_stmt = select(func.count()).select_from(BacktestRunRow)
        if strategy_id:
            count_stmt = count_stmt.where(BacktestRunRow.strategy_id == strategy_id)
        if status:
            count_stmt = count_stmt.where(BacktestRunRow.status == status)

        with get_session() as session:
            total = session.exec(count_stmt).one()
            rows = list(session.exec(stmt.offset(offset).limit(limit)).all())
        return total, rows

    @classmethod
    def delete_by_id(cls, run_id: str) -> bool:
        with get_session() as session:
            row = session.get(BacktestRunRow, run_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
