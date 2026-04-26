from __future__ import annotations

import asyncio
from pathlib import Path
from typing import cast

from langgraph.store.sqlite.aio import AsyncSqliteStore
from workspace import workspace_path

_store_lock = asyncio.Lock()
_async_store: AsyncSqliteStore | None = None
_async_store_cm = None


def agent_store_path() -> Path:
    return workspace_path("data/agent-store.sqlite3")


async def get_agent_store() -> AsyncSqliteStore:
    global _async_store
    global _async_store_cm
    store_path = agent_store_path()
    store_path.parent.mkdir(parents=True, exist_ok=True)
    if _async_store is not None:
        return _async_store

    async with _store_lock:
        if _async_store is not None:
            return _async_store
        # Keep a single long-lived connection for the process lifetime.
        # AsyncSqliteStore.from_conn_string is an async context manager,
        # so we enter it manually once and reuse the yielded store.
        _async_store_cm = AsyncSqliteStore.from_conn_string(store_path.as_posix())
        store = await _async_store_cm.__aenter__()
        _async_store = cast(AsyncSqliteStore, store)
        return _async_store
