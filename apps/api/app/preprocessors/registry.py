from __future__ import annotations

from sqlmodel import select

from app.common.id import create_id_generator
from app.persistence.sqlite_db import get_session
from app.preprocessors.models import PreprocessorRow
from app.preprocessors.schemas import PreprocessorRegistryFile


class PreprocessorsRegistry:
    id_generator = create_id_generator("PreprocessorsRegistry")

    @classmethod
    def generate_id(cls, name: str | None = None) -> str:
        return cls.id_generator(name)

    @classmethod
    def list_items(cls) -> list[PreprocessorRow]:
        with get_session() as session:
            return list(session.exec(select(PreprocessorRow)))

    @classmethod
    def get_item(cls, item_id: str) -> PreprocessorRow | None:
        with get_session() as session:
            return session.get(PreprocessorRow, item_id)

    @classmethod
    def add_item(cls, item: PreprocessorRow) -> PreprocessorRow:
        with get_session() as session:
            session.add(item)
            session.commit()
            session.refresh(item)
            session.expunge(item)
            return item

    @classmethod
    def update_item(cls, item_id: str, fn) -> PreprocessorRow | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(PreprocessorRow, item_id)
            if row is None:
                return None
            fn(row)
            session.merge(row)
            session.commit()
            session.refresh(row)
            session.expunge(row)
            return row

    @classmethod
    def delete_item(cls, item_id: str) -> PreprocessorRow | None:
        with get_session() as session:
            row = session.get(PreprocessorRow, item_id)
            if row is None:
                return None
            session.delete(row)
            session.commit()
            return row

    @classmethod
    def load(cls) -> PreprocessorRegistryFile:
        return PreprocessorRegistryFile(items=cls.list_items())
