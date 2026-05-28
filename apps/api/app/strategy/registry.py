from __future__ import annotations

from sqlmodel import select

from app.persistence.sqlite_db import get_session
from app.strategy.models import StrategyRow


class StrategyRegistry:
    """DB-backed registry for strategies."""

    @classmethod
    def list_all(cls) -> list[StrategyRow]:
        with get_session() as session:
            return list(session.exec(select(StrategyRow)))

    @classmethod
    def get_by_id(cls, strategy_id: str) -> StrategyRow | None:
        with get_session() as session:
            return session.get(StrategyRow, strategy_id)

    @classmethod
    def save(cls, row: StrategyRow) -> None:
        with get_session() as session:
            session.merge(row)
            session.commit()

    @classmethod
    def delete_by_id(cls, strategy_id: str) -> bool:
        with get_session() as session:
            row = session.get(StrategyRow, strategy_id)
            if row is None:
                return False
            session.delete(row)
            session.commit()
            return True
