from __future__ import annotations

from typing import Any

from app.chat.agents.hitl_checkpointer import get_hitl_checkpointer
from app.chat.agents.store import get_agent_store
from app.tool.controller import ToolController
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph.state import CompiledStateGraph


def create_main_agent(model: str | BaseChatModel) -> CompiledStateGraph[Any, Any, Any, Any]:
    ctrl = ToolController()
    tools_by_id = ctrl.get_tools()
    disabled, need_authorize = ctrl.split_tool_ids_by_authorization(tools_by_id.keys())

    enabled_tools: list[Any] = []
    interrupt_on: dict[str, bool] = {}
    for tool_id, tool in tools_by_id.items():
        if tool_id in disabled:
            continue
        runtime_tool_name = (getattr(tool, "name", "") or "").strip()
        if not runtime_tool_name:
            continue
        enabled_tools.append(tool)
        if tool_id not in need_authorize:
            continue
        interrupt_on[runtime_tool_name] = True
    return create_deep_agent(
        model=model,
        tools=enabled_tools,
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
        interrupt_on=interrupt_on or None,
        checkpointer=get_hitl_checkpointer() if interrupt_on else None,
        store=get_agent_store(),
    )
