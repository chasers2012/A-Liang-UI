from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from sqlalchemy.pool import NullPool
from sqlmodel import Session, SQLModel, create_engine
from workspace import workspace_path


def sqlite_db_path() -> Path:
    # Keep DB inside workspace so it is portable with the project workspace data.
    return workspace_path("data/db.sqlite3")


@lru_cache(maxsize=1)
def get_engine():
    db_path = sqlite_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    def _connect_with_pragmas() -> sqlite3.Connection:
        conn = sqlite3.connect(db_path.as_posix(), check_same_thread=False)
        # Improve concurrency/durability tradeoffs for a local app.
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    # NullPool: open/close a real sqlite connection per Session checkout. Avoids
    # SingletonThreadPool holding a connection that sqlite has already closed
    # (seen as "Cannot operate on a closed database" under thread-pool workers).
    return create_engine(
        "sqlite://",
        creator=_connect_with_pragmas,
        poolclass=NullPool,
        pool_pre_ping=True,
    )


def create_db_and_tables() -> None:
    # Ensure all SQLModel table classes are imported and registered.
    from app.packages.agents import models as _agent_models  # noqa: F401
    from app.packages.backtest import models as _backtest_models  # noqa: F401
    from app.packages.chat import models as _chat_models  # noqa: F401
    from app.packages.data_set import models as _dataset_models  # noqa: F401
    from app.packages.datasource import models as _datasource_models  # noqa: F401
    from app.packages.evaluation.profile import models as _evaluation_profile_models  # noqa: F401
    from app.packages.evaluation.run import models as _evaluation_run_models  # noqa: F401
    from app.packages.factors import models as _factor_models  # noqa: F401
    from app.packages.knowledge import models as _knowledge_models  # noqa: F401
    from app.packages.nodes import models as _node_models  # noqa: F401
    from ..scheduler import models as _scheduler_models  # noqa: F401
    from app.packages.strategy import models as _strategy_models  # noqa: F401
    from app.packages.tool import models as _tool_models  # noqa: F401
    from app.packages.visibility import models as _visibility_models  # noqa: F401

    engine = get_engine()
    SQLModel.metadata.create_all(engine)


@contextmanager
def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
