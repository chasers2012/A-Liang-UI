from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from sqlalchemy import event, text
from sqlmodel import Session, SQLModel, create_engine
from workspace import workspace_path


def _migrate_data_sets_instrument_codes_column(engine) -> None:  # type: ignore[no-untyped-def]
    """Rename legacy ``stock_codes`` column to ``instrument_codes`` if present."""
    with engine.begin() as conn:
        if (
            conn.execute(
                text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='data_sets' LIMIT 1")
            ).scalar()
            is None
        ):
            return
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(data_sets)"))}
        if "instrument_codes" in cols or "stock_codes" not in cols:
            return
        conn.execute(text("ALTER TABLE data_sets RENAME COLUMN stock_codes TO instrument_codes"))


def sqlite_db_path() -> Path:
    # Keep DB inside workspace so it is portable with the project workspace data.
    return workspace_path("data/db.sqlite3")


@lru_cache(maxsize=1)
def get_engine():
    db_path = sqlite_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _):  # type: ignore[no-untyped-def]
        # Improve concurrency/durability tradeoffs for a local app.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

    return engine


def create_db_and_tables() -> None:
    # Ensure all SQLModel table classes are imported and registered.
    from app.persistence import models as _models  # noqa: F401

    eng = get_engine()
    SQLModel.metadata.create_all(eng)
    _migrate_data_sets_instrument_codes_column(eng)


@contextmanager
def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
