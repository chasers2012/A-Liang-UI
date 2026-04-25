from __future__ import annotations

import contextlib
from typing import ClassVar

from factor import Factor
from sqlmodel import select

from app.common.datetime_utils import utc_now_iso
from app.factors.models import FactorRow
from app.persistence.sqlite_db import get_session

FACTORS_REGISTRY_FILENAME = "factors/registry.json"


class FactorItemsRegistry:
    _plugin_factors: ClassVar[dict[str, type[Factor]]] = {}

    @classmethod
    def register_plugin_factor(cls, factor_id: str, factor_cls: type[Factor]) -> None:
        fid = str(factor_id).strip()
        if not fid:
            raise ValueError("plugin factor id must be non-empty")
        cls._plugin_factors[fid] = factor_cls
        now = utc_now_iso()
        deps: list[str] = []
        with contextlib.suppress(Exception):
            deps = factor_cls().dependency_fields()
        with get_session() as session:
            session.merge(
                FactorRow(
                    id=fid,
                    name=fid,
                    group=getattr(factor_cls, "group", "factor") or "factor",
                    description=getattr(factor_cls, "description", "") or "",
                    is_plugin=True,
                    dependencies=deps,
                    source_path="",
                    created_at=now,
                    updated_at=now,
                )
            )
            session.commit()

    @classmethod
    def get_plugin_factor(cls, factor_id: str) -> type[Factor] | None:
        return cls._plugin_factors.get(str(factor_id).strip())

    @classmethod
    def list_items(cls) -> list[FactorRow]:
        with get_session() as session:
            return list(session.exec(select(FactorRow)))

    @classmethod
    def get_item(cls, item_id: str) -> FactorRow | None:
        with get_session() as session:
            return session.get(FactorRow, item_id)

    @classmethod
    def add_item(cls, item: FactorRow) -> FactorRow:
        with get_session() as session:
            session.add(item)
            session.commit()
            session.refresh(item)
            session.expunge(item)
            return item

    @classmethod
    def update_item(cls, item_id: str, fn) -> FactorRow | None:  # type: ignore[no-untyped-def]
        with get_session() as session:
            row = session.get(FactorRow, item_id)
            if row is None:
                return None
            fn(row)
            session.merge(row)
            session.commit()
            session.refresh(row)
            session.expunge(row)
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
