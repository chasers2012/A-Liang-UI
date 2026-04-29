from __future__ import annotations

from typing import Any

from app.chat.agents.hitl_checkpointer import get_hitl_checkpointer
from app.chat.agents.store import get_agent_store
from app.chat.agents.subagnets import SUBAGENT_BUILDERS
from deepagents._models import resolve_model
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from deepagents.graph import (
    _harness_profile_for_model,
    _resolve_extra_middleware,
)
from deepagents.middleware._tool_exclusion import _ToolExclusionMiddleware
from deepagents.middleware.memory import MemoryMiddleware
from deepagents.middleware.patch_tool_calls import PatchToolCallsMiddleware
from deepagents.middleware.permissions import FilesystemPermission, _PermissionMiddleware
from deepagents.middleware.subagents import SubAgentMiddleware
from deepagents.middleware.summarization import create_summarization_middleware
from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph.state import CompiledStateGraph


async def create_main_agent(model: str | BaseChatModel) -> CompiledStateGraph[Any, Any, Any, Any]:
    model_spec = model if isinstance(model, str) else None
    resolved_model = resolve_model(model)
    profile = _harness_profile_for_model(resolved_model, model_spec)

    subagents = []
    for builder in SUBAGENT_BUILDERS:
        subagents.append(builder())
    has_interrupt_on = any(
        isinstance(subagent.get("interrupt_on"), dict) and bool(subagent.get("interrupt_on"))
        for subagent in subagents
    )

    backend = CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": StoreBackend(namespace=lambda _rt: ("filesystem",)),
        },
    )

    permissions = [
        FilesystemPermission(
            operations=["write", "read"],
            paths=["/**"],
            mode="deny",
        ),
    ]
    default_subagent_model = model_spec or resolved_model
    inline_subagents = [
        {
            **subagent,
            "model": subagent.get("model", default_subagent_model),
        }
        for subagent in subagents
    ]

    middleware = [
        TodoListMiddleware(),
        SubAgentMiddleware(
            backend=backend,
            subagents=inline_subagents,
            task_description=profile.tool_description_overrides.get("task"),
        ),
        create_summarization_middleware(resolved_model, backend),
        PatchToolCallsMiddleware(),
        *_resolve_extra_middleware(profile),
        AnthropicPromptCachingMiddleware(unsupported_model_behavior="ignore"),
        MemoryMiddleware(backend=backend, sources=["/memories/"]),
        _PermissionMiddleware(rules=permissions, backend=backend),
    ]
    if profile.excluded_tools:
        middleware.insert(
            -3,
            _ToolExclusionMiddleware(excluded=profile.excluded_tools),
        )

    system_prompt = (
        "你是一个量化分析系统的接入口。"
        "系统的所有能力都在子代理（subagents）中实现，你负责分析需求、制定计划，委派给合适的子代理，并总结它们返回的结果，你不要做除此以外的其他任何工作。"
        "你需要根据子代理的职责划分理解系统分而治之的设计理念，并据此完成你的工作。"
        "禁止直接着手实现需求，禁止直接使用你的先验知识。"
        "你需要使用具体、简短的指令来调用子代理，使用祈使句。"
    )

    return create_agent(
        model=resolved_model,
        system_prompt=system_prompt,
        middleware=middleware,
        checkpointer=get_hitl_checkpointer() if has_interrupt_on else None,
        store=await get_agent_store(),
    ).with_config(
        {
            "recursion_limit": 9_999,
            "metadata": {
                "lc_agent_name": None,
            },
        }
    )
