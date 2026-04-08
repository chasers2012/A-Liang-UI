from __future__ import annotations

from sqlmodel import select

from app.datasources.schemas import CsvConfigStored, DataSourceRecord, SqlConfigStored
from app.persistence.models import DataSourceRow
from app.persistence.sqlite_db import get_session

REGISTRY_FILENAME = "datasources/registry.json"


def _row_to_record(row: DataSourceRow) -> DataSourceRecord:
    sql = SqlConfigStored.model_validate(row.sql) if row.sql is not None else None
    csv = CsvConfigStored.model_validate(row.csv) if row.csv is not None else None
    return DataSourceRecord(
        id=row.id,
        name=row.name,
        type=row.type,  # type: ignore[arg-type]
        enabled=row.enabled,
        sql=sql,
        csv=csv,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _record_to_row(rec: DataSourceRecord) -> DataSourceRow:
    return DataSourceRow(
        id=rec.id,
        name=rec.name,
        type=rec.type,
        enabled=rec.enabled,
        sql=(rec.sql.model_dump(mode="json") if rec.sql is not None else None),
        csv=(rec.csv.model_dump(mode="json") if rec.csv is not None else None),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


class DataSourceItemsRegistry:
    @classmethod
    def list_items(cls) -> list[DataSourceRecord]:
        with get_session() as session:
            rows = list(session.exec(select(DataSourceRow)))
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, item_id: str) -> DataSourceRecord | None:
        with get_session() as session:
            row = session.get(DataSourceRow, item_id)
            if row is None:
                return None
            return _row_to_record(row)

    @classmethod
    def add_item(cls, item: DataSourceRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(item))
            session.commit()

    @classmethod
    def update_item(cls, item_id: str, fn) -> DataSourceRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(DataSourceRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            fn(rec)
            session.merge(_record_to_row(rec))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, item_id: str) -> DataSourceRecord | None:
        with get_session() as session:
            row = session.get(DataSourceRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            session.delete(row)
            session.commit()
            return rec
