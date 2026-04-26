from __future__ import annotations

from typing import Any

from app.chat.agents.store import get_agent_store
from app.tool.controller import ToolController
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph.state import CompiledStateGraph


def create_main_agent(model: str | BaseChatModel) -> CompiledStateGraph[Any, Any, Any, Any]:
    return create_deep_agent(
        model=model,
        tools=ToolController().get_tools().values(),
        memory=["/memories/AGENTS.md"],
        skills=["/skills/"],
        system_prompt="你是一个量化研究执行助手，请优先基于可用能力完成用户请求。",
        backend=CompositeBackend(
            default=StateBackend(),
            routes={
                "/memories/": StoreBackend(),
                "/skills/": StoreBackend(),
            },
        ),
        store=get_agent_store(),
    )
