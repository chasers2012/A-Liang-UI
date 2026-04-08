from __future__ import annotations

from collections.abc import Callable
from typing import Generic, TypeVar

from sqlmodel import Session, select

from app.persistence.sqlite_db import get_session

T = TypeVar("T")


class SqliteItemsRegistry(Generic[T]):
    """
    Minimal DB-backed registry with an API similar to WorkspaceItemsRegistry.

    Subclasses must set `model` to a SQLModel table class.
    """

    model: type[T]

    @classmethod
    def list_items(cls) -> list[T]:
        with get_session() as session:
            return list(session.exec(select(cls.model)))

    @classmethod
    def get_item(cls, item_id: str) -> T | None:
        with get_session() as session:
            return session.get(cls.model, item_id)

    @classmethod
    def add_item(cls, item: T) -> None:
        with get_session() as session:
            session.add(item)  # type: ignore[arg-type]
            session.commit()

    @classmethod
    def upsert_item(cls, item: T) -> None:
        with get_session() as session:
            session.merge(item)  # type: ignore[arg-type]
            session.commit()

    @classmethod
    def update_item(
        cls,
        item_id: str,
        fn: Callable[[T], None],
        *,
        after_mutate: Callable[[Session], None] | None = None,
    ) -> T | None:
        with get_session() as session:
            rec = session.get(cls.model, item_id)
            if rec is None:
                return None
            fn(rec)
            if after_mutate is not None:
                after_mutate(session)
            session.add(rec)  # type: ignore[arg-type]
            session.commit()
            session.refresh(rec)  # type: ignore[arg-type]
            return rec

    @classmethod
    def delete_item(cls, item_id: str) -> T | None:
        with get_session() as session:
            rec = session.get(cls.model, item_id)
            if rec is None:
                return None
            session.delete(rec)  # type: ignore[arg-type]
            session.commit()
            return rec
