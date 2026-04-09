from __future__ import annotations

from sqlmodel import select

from app.common.id import create_id_generator
from app.persistence.models import PreprocessorRow
from app.persistence.sqlite_db import get_session
from app.preprocessors.schemas import PreprocessorRecord, PreprocessorRegistryFile


def _row_to_record(row: PreprocessorRow) -> PreprocessorRecord:
    return PreprocessorRecord(
        id=row.id,
        name=row.name,
        description=row.description,
        source_path=row.source_path,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _record_to_row(rec: PreprocessorRecord) -> PreprocessorRow:
    return PreprocessorRow(
        id=rec.id,
        name=rec.name,
        description=rec.description,
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


class PreprocessorsRegistry:
    id_generator = create_id_generator("PreprocessorsRegistry")

    @classmethod
    def generate_id(cls, name: str | None = None) -> str:
        return cls.id_generator(name)

    @classmethod
    def list_items(cls) -> list[PreprocessorRecord]:
        with get_session() as session:
            rows = list(session.exec(select(PreprocessorRow)))
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, item_id: str) -> PreprocessorRecord | None:
        with get_session() as session:
            row = session.get(PreprocessorRow, item_id)
        return _row_to_record(row) if row is not None else None

    @classmethod
    def add_item(cls, item: PreprocessorRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(item))
            session.commit()

    @classmethod
    def update_item(cls, item_id: str, fn) -> PreprocessorRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(PreprocessorRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            fn(rec)
            session.merge(_record_to_row(rec))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, item_id: str) -> PreprocessorRecord | None:
        with get_session() as session:
            row = session.get(PreprocessorRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            session.delete(row)
            session.commit()
            return rec

    @classmethod
    def load(cls) -> PreprocessorRegistryFile:
        return PreprocessorRegistryFile(items=cls.list_items())
