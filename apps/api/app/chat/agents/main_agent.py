from __future__ import annotations

import atexit
from contextlib import ExitStack
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.tool.controller import ToolController
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph.state import CompiledStateGraph
from langgraph.store.base import BaseStore
from langgraph.store.sqlite import SqliteStore
from workspace import workspace_path

_store_exit_stack = ExitStack()
atexit.register(_store_exit_stack.close)


def _agent_store_path() -> Path:
    return workspace_path("data/agent-store.sqlite3")


@lru_cache(maxsize=1)
def _get_agent_store() -> BaseStore:
    store_path = _agent_store_path()
    store_path.parent.mkdir(parents=True, exist_ok=True)
    return _store_exit_stack.enter_context(SqliteStore.from_conn_string(store_path.as_posix()))


def create_main_agent(model: str | BaseChatModel) -> CompiledStateGraph[Any, Any, Any, Any]:
    return create_deep_agent(
        model=model,
        tools=ToolController().get_tools().values(),
        memory=["/memories/AGENTS.md"],
        system_prompt="你是一个量化研究执行助手，请优先基于可用能力完成用户请求。",
        backend=CompositeBackend(
            default=StateBackend(),
            routes={
                "/memories/": StoreBackend(),
                "/skills/": StoreBackend(),
            },
        ),
        store=_get_agent_store(),
    )
