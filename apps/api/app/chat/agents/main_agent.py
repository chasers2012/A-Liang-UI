from __future__ import annotations

from typing import Any

from app.chat.agents.hitl_checkpointer import get_hitl_checkpointer
from app.chat.agents.store import get_agent_store
from app.chat.agents.subagnets import SUBAGENT_BUILDERS
from app.tool.controller import ToolController
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from deepagents.middleware.summarization import create_summarization_tool_middleware
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph.state import CompiledStateGraph

TOOL_IDS = {
    "strategy.get_strategy_list",
    "strategy.get_strategy_detail",
    "strategy.load_strategy_detail",
    "datasource.get_datasource_list",
    "datasource.get_datasource_detail",
    "data_set.get_data_set_list",
    "data_set.get_data_set_detail",
    "factor.get_factor_list",
    "factor.get_factor_detail",
    "node.get_workflow_node_list",
    "evaluation_profile.get_evaluation_profile_list",
    "evaluation_run.list_evaluation_runs",
    "backtest.get_backtest_runs",
    "backtest.get_backtest_run_detail",
}


async def create_main_agent(model: str | BaseChatModel) -> CompiledStateGraph[Any, Any, Any, Any]:
    ctrl = ToolController()
    tools_by_id = ctrl.get_tools()
    _, need_authorize = ctrl.split_tool_ids_by_authorization(tools_by_id.keys())
    subagents = []
    for builder in SUBAGENT_BUILDERS:
        subagent = builder(tools_by_id, need_authorize_tool_ids=need_authorize)
        if subagent:
            subagents.append(subagent)
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

    def build_subagent_tools(
        all_tools_by_id: dict[str, Any],
        *,
        candidate_tool_ids: set[str],
    ) -> list[Any]:
        picked: list[Any] = []
        for tool_id in candidate_tool_ids:
            tool = all_tools_by_id.get(tool_id)
            if tool is None:
                continue
            runtime_tool_name = (getattr(tool, "name", "") or "").strip()
            if not runtime_tool_name:
                continue
            picked.append(tool)
        return picked

    tools = build_subagent_tools(tools_by_id, candidate_tool_ids=TOOL_IDS)

    return create_deep_agent(
        model=model,
        memory=["/memories/"],
        system_prompt=(
            "你是一个量化分析系统的接入口。系统的所有能力都在子代理（subagents）中实现，你负责分析需求、制定计划，委派给合适的子代理，并总结它们返回的结果，你不要做除此以外的其他任何工作。"
            "你需要根据子代理的职责划分理解系统分而治之的设计理念，并据此完成你的工作。"
            "禁止直接着手实现需求，禁止直接使用你的先验知识，同样禁止在general-purpose子代理中做这些事。"
            "你需要使用具体、简短的指令来调用子代理，使用祈使句。"
        ),
        tools=tools,
        backend=backend,
        middleware=[
            create_summarization_tool_middleware(model, backend),
        ],
        subagents=[
            *subagents,
            {
                "name": "general-purpose",
                "description": "Don't call this agent",
                "system_prompt": "You do nothing. 直接告知调用方你什么都不能做。",
                "tools": [],
            },
        ],
        checkpointer=get_hitl_checkpointer() if has_interrupt_on else None,
        store=await get_agent_store(),
    )
