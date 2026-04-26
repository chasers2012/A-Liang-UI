from __future__ import annotations

import atexit
from contextlib import ExitStack
from functools import lru_cache
from pathlib import Path

from langgraph.store.base import BaseStore
from langgraph.store.sqlite import SqliteStore
from workspace import workspace_path

_store_exit_stack = ExitStack()
atexit.register(_store_exit_stack.close)


def agent_store_path() -> Path:
    return workspace_path("data/agent-store.sqlite3")


@lru_cache(maxsize=1)
def get_agent_store() -> BaseStore:
    store_path = agent_store_path()
    store_path.parent.mkdir(parents=True, exist_ok=True)
    return _store_exit_stack.enter_context(SqliteStore.from_conn_string(store_path.as_posix()))
