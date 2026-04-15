from __future__ import annotations

from sqlmodel import select

from app.factors.models import FactorRow
from app.factors.schemas import (
    FactorCreate,
    FactorDetailPublic,
    FactorPatch,
    FactorSummaryPublic,
)
from app.persistence.sqlite_db import get_session

FACTORS_REGISTRY_FILENAME = "factors/registry.json"


class FactorItemsRegistry:
    @classmethod
    def list_items(cls) -> list[FactorRow]:
        with get_session() as session:
            return list(session.exec(select(FactorRow)))

    @classmethod
    def get_item(cls, item_id: str) -> FactorRow | None:
        with get_session() as session:
            return session.get(FactorRow, item_id)

    @classmethod
    def add_item(cls, item: FactorRow) -> None:
        with get_session() as session:
            session.add(item)
            session.commit()

    @classmethod
    def update_item(cls, item_id: str, fn) -> FactorRow | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(FactorRow, item_id)
            if row is None:
                return None
            fn(row)
            session.merge(row)
            session.commit()
            return row

    @classmethod
    def delete_item(cls, item_id: str) -> FactorRow | None:
        with get_session() as session:
            row = session.get(FactorRow, item_id)
            if row is None:
                return None
            session.delete(row)
            session.commit()
            return row

    @classmethod
    def create_factor(cls, body: FactorCreate) -> FactorRow:
        from app.factors.controller import create_factor as create_factor_controller

        return create_factor_controller(body)

    @classmethod
    def update_factor(cls, factor_id: str, body: FactorPatch) -> FactorRow:
        from app.factors.controller import update_factor as update_factor_controller

        return update_factor_controller(factor_id, body)

    @classmethod
    def get_factor(cls, factor_id: str):
        from app.factors.controller import get_factor as get_factor_controller

        return get_factor_controller(factor_id)


def factor_detail(rec: FactorRow) -> FactorDetailPublic:
    from app.factors.controller import factor_detail as factor_detail_controller

    return factor_detail_controller(rec)


def read_source(rec: FactorRow) -> str:
    from app.factors.controller import read_factor_source

    return read_factor_source(rec)


def delete_source_file(rec: FactorRow) -> None:
    from app.factors.controller import delete_factor_source_file

    delete_factor_source_file(rec)


def list_factors() -> list[FactorSummaryPublic]:
    from app.factors.controller import list_factors as list_factors_controller

    return list_factors_controller()
