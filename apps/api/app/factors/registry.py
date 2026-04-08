from __future__ import annotations

from sqlmodel import select

from app.factors.schemas import (
    FactorCreate,
    FactorDetailPublic,
    FactorPatch,
    FactorRecord,
    FactorSummaryPublic,
)
from app.persistence.models import FactorRow
from app.persistence.sqlite_db import get_session

FACTORS_REGISTRY_FILENAME = "factors/registry.json"


def _row_to_record(row: FactorRow) -> FactorRecord:
    return FactorRecord(
        id=row.id,
        name=row.name,
        group=row.group,
        description=row.description,
        max_window=row.max_window,
        dependencies=list(row.dependencies or []),
        source_path=row.source_path,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _record_to_row(rec: FactorRecord) -> FactorRow:
    return FactorRow(
        id=rec.id,
        name=rec.name,
        group=rec.group,
        description=rec.description,
        max_window=rec.max_window,
        dependencies=list(rec.dependencies),
        source_path=rec.source_path,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


class FactorItemsRegistry:
    @classmethod
    def list_items(cls) -> list[FactorRecord]:
        with get_session() as session:
            rows = list(session.exec(select(FactorRow)))
        return [_row_to_record(r) for r in rows]

    @classmethod
    def get_item(cls, item_id: str) -> FactorRecord | None:
        with get_session() as session:
            row = session.get(FactorRow, item_id)
            if row is None:
                return None
            return _row_to_record(row)

    @classmethod
    def add_item(cls, item: FactorRecord) -> None:
        with get_session() as session:
            session.add(_record_to_row(item))
            session.commit()

    @classmethod
    def update_item(cls, item_id: str, fn) -> FactorRecord | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(FactorRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            fn(rec)
            session.merge(_record_to_row(rec))
            session.commit()
            return rec

    @classmethod
    def delete_item(cls, item_id: str) -> FactorRecord | None:
        with get_session() as session:
            row = session.get(FactorRow, item_id)
            if row is None:
                return None
            rec = _row_to_record(row)
            session.delete(row)
            session.commit()
            return rec

    @classmethod
    def create_factor(cls, body: FactorCreate) -> FactorRecord:
        from app.factors.controller import create_factor as create_factor_controller

        return create_factor_controller(body)

    @classmethod
    def update_factor(cls, factor_id: str, body: FactorPatch) -> FactorRecord:
        from app.factors.controller import update_factor as update_factor_controller

        return update_factor_controller(factor_id, body)

    @classmethod
    def get_factor(cls, factor_id: str):
        from app.factors.controller import get_factor as get_factor_controller

        return get_factor_controller(factor_id)


def factor_detail(rec: FactorRecord) -> FactorDetailPublic:
    from app.factors.controller import factor_detail as factor_detail_controller

    return factor_detail_controller(rec)


def read_source(rec: FactorRecord) -> str:
    from app.factors.controller import read_factor_source

    return read_factor_source(rec)


def delete_source_file(rec: FactorRecord) -> None:
    from app.factors.controller import delete_factor_source_file

    delete_factor_source_file(rec)


def list_factors() -> list[FactorSummaryPublic]:
    from app.factors.controller import list_factors as list_factors_controller

    return list_factors_controller()
