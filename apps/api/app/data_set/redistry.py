from __future__ import annotations

from sqlmodel import col, select

from app.data_set.schemas import DataSetDatasourceBindingStored, DataSetRecord
from app.persistence.models import DataSetRow
from app.persistence.sqlite_db import get_session


def _row_to_record(row: DataSetRow) -> DataSetRecord:
    raw = row.datasource_bindings or []
    bindings = [DataSetDatasourceBindingStored.model_validate(x) for x in raw]
    return DataSetRecord(
        id=row.id,
        name=row.name,
        description=row.description,
        datasource_bindings=bindings,
        start=row.start,
        end=row.end,
        stock_codes=list(row.stock_codes or []),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _record_to_row(rec: DataSetRecord) -> DataSetRow:
    return DataSetRow(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        datasource_bindings=[b.model_dump() for b in rec.datasource_bindings],
        start=rec.start,
        end=rec.end,
        stock_codes=list(rec.stock_codes),
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


class DataSetsStore:
    """SQLite persistence for the data set registry."""

    @classmethod
    def list_items(cls) -> list[DataSetRecord]:
        with get_session() as session:
            rows = list(session.exec(select(DataSetRow).order_by(col(DataSetRow.created_at))))
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, item_id: str) -> DataSetRecord | None:
        with get_session() as session:
            row = session.get(DataSetRow, item_id)
            if row is None:
                return None
            return _row_to_record(row)

    @classmethod
    def add_item(cls, item: DataSetRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(item))
            session.commit()

    @classmethod
    def update_item(cls, item_id: str, fn) -> DataSetRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(DataSetRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            fn(rec)
            session.merge(_record_to_row(rec))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, item_id: str) -> DataSetRecord | None:
        with get_session() as session:
            row = session.get(DataSetRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            session.delete(row)
            session.commit()
            return rec
