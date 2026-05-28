from __future__ import annotations

from sqlmodel import select

from app.datasource.models import DataSourceRow
from app.persistence.sqlite_db import get_session

REGISTRY_FILENAME = "datasources/registry.json"


class DataSourceItemsRegistry:
    @classmethod
    def list_items(cls) -> list[DataSourceRow]:
        with get_session() as session:
            return list(session.exec(select(DataSourceRow)))

    @classmethod
    def get_item(cls, item_id: str) -> DataSourceRow | None:
        with get_session() as session:
            return session.get(DataSourceRow, item_id)

    @classmethod
    def add_item(cls, item: DataSourceRow) -> DataSourceRow:
        with get_session() as session:
            session.add(item)
            session.commit()
            session.refresh(item)
            session.expunge(item)
            return item

    @classmethod
    def update_item(cls, item_id: str, fn) -> DataSourceRow | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(DataSourceRow, item_id)
            if row is None:
                return None
            fn(row)
            session.merge(row)
            session.commit()
            session.refresh(row)
            session.expunge(row)
            return row

    @classmethod
    def delete_item(cls, item_id: str) -> DataSourceRow | None:
        with get_session() as session:
            row = session.get(DataSourceRow, item_id)
            if row is None:
                return None
            session.delete(row)
            session.commit()
            return row
