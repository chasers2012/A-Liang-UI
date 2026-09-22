from __future__ import annotations

from sqlmodel import col, select

from app.packages.data_set.models import DataSetRow
from app.infra.persistence.sqlite_db import get_session


class DataSetsStore:
    """SQLite persistence for the data set registry."""

    @classmethod
    def list_items(cls) -> list[DataSetRow]:
        with get_session() as session:
            return list(session.exec(select(DataSetRow).order_by(col(DataSetRow.created_at))))

    @classmethod
    def get_item(cls, item_id: str) -> DataSetRow | None:
        with get_session() as session:
            return session.get(DataSetRow, item_id)

    @classmethod
    def add_item(cls, item: DataSetRow) -> DataSetRow:
        with get_session() as session:
            session.add(item)
            session.commit()
            session.refresh(item)
            session.expunge(item)
            return item

    @classmethod
    def update_item(cls, item_id: str, fn) -> DataSetRow | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(DataSetRow, item_id)
            if row is None:
                return None
            fn(row)
            session.merge(row)
            session.commit()
            session.refresh(row)
            session.expunge(row)
            return row

    @classmethod
    def delete_item(cls, item_id: str) -> DataSetRow | None:
        with get_session() as session:
            row = session.get(DataSetRow, item_id)
            if row is None:
                return None
            session.delete(row)
            session.commit()
            return row
