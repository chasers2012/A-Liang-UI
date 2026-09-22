from __future__ import annotations

from typing import Any

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
from deepagents.middleware.skills import SkillsMiddleware
from deepagents.middleware.subagents import SubAgentMiddleware
from deepagents.middleware.summarization import create_summarization_middleware
from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph.state import CompiledStateGraph

from . import controller as agents_controller
from . import controller as tool_controller

from .store import get_agent_store
from .subagent_catalog import get_subagent_catalog_item
from .subagents import SUBAGENT_BUILDERS

_CHECKPOINTER: MemorySaver | None = None

TASK_SYSTEM_PROMPT = """## `task` (subagent spawner)

You have access to a `task` tool to launch short-lived subagents that handle isolated tasks. These agents are ephemeral — they live only for the duration of the task and return a single result.

When to use the task tool:
- When a task requires abilities you don't have
- When you only care about the output of the subagent, and not the intermediate steps (ex. performing a lot of research and then returned a synthesized report, performing a series of computations or lookups to achieve a concise, relevant answer.)

Subagent lifecycle:
1. **Spawn** → Provide clear role, instructions, and expected output
2. **Run** → The subagent completes the task autonomously
3. **Return** → The subagent provides a single structured result
4. **Reconcile** → Incorporate or synthesize the result into the main thread

When NOT to use the task tool:
- If you need to see the intermediate reasoning or steps after the subagent has completed (the task tool hides them)

"""


def _get_hitl_checkpointer() -> MemorySaver:
    global _CHECKPOINTER
    if _CHECKPOINTER is None:
        _CHECKPOINTER = MemorySaver()
    return _CHECKPOINTER


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
            "/skills/": StoreBackend(namespace=lambda _rt: ("filesystem",)),
        },
    )

    permissions = [
        FilesystemPermission(
            operations=["read"],
            paths=["/skills/**"],
            mode="allow",
        ),
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
        SkillsMiddleware(backend=backend, sources=["/skills/"]),
        SubAgentMiddleware(
            backend=backend,
            subagents=inline_subagents,
            task_description=profile.tool_description_overrides.get("task"),
            system_prompt=TASK_SYSTEM_PROMPT,
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
    main_agent_catalog_item = get_subagent_catalog_item("main_agent")
    if main_agent_catalog_item is None:
        raise RuntimeError("missing subagent catalog item: main_agent")
    main_agent_tool_ids = agents_controller.get_subagent_tool_ids(
        "main_agent",
        list(main_agent_catalog_item.default_tool_ids),
    )
    tools_by_id = tool_controller.get_tools()
    main_agent_tools = [
        tools_by_id[tool_id] for tool_id in main_agent_tool_ids if tool_id in tools_by_id
    ]

    system_prompt = (
        "你是一个量化分析系统的接入口。"
        "系统的所有能力都在子代理（subagents）中实现，你负责分析需求、制定计划，委派给合适的子代理，并总结它们返回的结果，你不要做除此以外的其他任何工作。"
        "你需要根据子代理的职责划分理解系统分而治之的设计理念，并据此完成你的工作。"
        "禁止直接着手实现需求，禁止直接使用你的先验知识。"
        "你需要使用具体、简短的指令来调用子代理，使用祈使句。"
        "如果子代理上报了任何资源缺失或规则冲突，你必须重新制定计划或设计方案，禁止直接将问题返回给用户。"
    )

    return create_agent(
        model=resolved_model,
        tools=main_agent_tools,
        system_prompt=system_prompt,
        middleware=middleware,
        checkpointer=_get_hitl_checkpointer() if has_interrupt_on else None,
        store=await get_agent_store(),
    ).with_config(
        {
            "recursion_limit": 9_999,
            "metadata": {
                "lc_agent_name": None,
            },
        }
    )
