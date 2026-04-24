from __future__ import annotations

import logging
from typing import Any

from app.tool.controller import ToolController
from langchain.agents import AgentState, create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class PlanExecuteState(AgentState[Any], total=False):
    plan: list[str]
    current_step: int
    completed_steps: list[str]


class PlannerPlanOutput(BaseModel):
    """Planner 输出结构。"""

    plan: list[str] = Field(
        ...,
        description="按顺序执行的计划步骤列表；每个元素是纯文本步骤描述。",
        min_length=1,
    )


def _format_plan_message(plan: list[str]) -> str:
    if not plan:
        return "计划已生成，但没有可执行步骤。"
    lines = ["我将按以下计划执行："]
    lines.extend(f"{idx}. {step}" for idx, step in enumerate(plan, start=1))
    return "\n".join(lines)


def _plan_node(state: PlanExecuteState, model: str | BaseChatModel) -> PlanExecuteState:

    messages = state.get("messages", [])
    try:
        system_prompt = (
            "你是一个 planning agent。你的职责是分析用户目标并生成一个简洁、可执行的计划，计划将会交给executor执行。\n"
            "要求：\n"
            "1. 只输出计划，不要执行。\n"
            "2. 每个步骤独立、原子化，但对于一次工具调用的结果处理要在一个步骤内完成\n"
            "3. 不要扩展任务范围。\n"
            # "4. 你可以获取工具列表并安排executor调用，而不是你自己调用。\n"
            "5. 不要把信息展示和告知作为单独的步骤\n"
            "6. 当被问及系统中不包含的信息或具体的知识时，应当首先将查阅知识库列入计划"
        )
        planner = create_agent(
            model=model,
            tools=[],
            system_prompt=system_prompt,
            response_format=PlannerPlanOutput,
        )
        structured_result = planner.invoke(
            {"messages": messages},
            config={"recursion_limit": 10},
        )
        structured_response = structured_result.get("structured_response")
        plan = (
            structured_response.plan if isinstance(structured_response, PlannerPlanOutput) else None
        )
    except Exception:
        logger.exception("planner.invoke failed")
        plan = None

    if not plan:
        plan = ["直接回答用户请求并给出最终结论。"]
    plan_message = AIMessage(content=_format_plan_message(plan))
    return {
        "messages": [*messages, plan_message],
        "plan": plan,
        "current_step": 0,
        "completed_steps": [],
    }


def _execute_node(state: PlanExecuteState, model: str | BaseChatModel) -> PlanExecuteState:
    executor = create_agent(
        model=model,
        tools=list(ToolController().get_tools().values()),
        system_prompt=(
            "你是一个 execute agent。你需要根据给定的计划步骤完成当前步骤，并把结果写清楚。"
        ),
    )
    messages = state.get("messages", [])
    plan = state.get("plan", [])
    current_step = int(state.get("current_step", 0))
    completed_steps = list(state.get("completed_steps", []))
    if current_step >= len(plan):
        return {
            "messages": messages,
            "plan": plan,
            "current_step": current_step,
            "completed_steps": completed_steps,
        }

    step = plan[current_step]
    step_messages = [*messages, SystemMessage(content=f"执行当前计划步骤：{step}")]
    try:
        result = executor.invoke({"messages": step_messages})
        result_messages = result.get("messages", [])
        next_messages = result_messages
        current_step += 1
        completed_steps.append(step)
    except Exception as e:
        err_type = type(e).__name__
        logger.exception("executor.invoke failed at step=%s", current_step)
        next_messages = [
            *messages,
            SystemMessage(content=f"执行失败(step={current_step}): {err_type}: {e}"),
        ]

    return {
        "messages": next_messages,
        "plan": plan,
        "current_step": current_step,
        "completed_steps": completed_steps,
    }


def _should_continue_after_execute(state: PlanExecuteState) -> str:
    plan = state.get("plan", [])
    current_step = int(state.get("current_step", 0))
    if current_step >= len(plan):
        return END
    return "execute"


def create_main_agent(
    model: str | BaseChatModel,
) -> CompiledStateGraph[PlanExecuteState, Any, dict[str, Any], dict[str, Any]]:
    graph = StateGraph(PlanExecuteState)
    graph.add_node("plan", lambda state: _plan_node(state, model))
    graph.add_node("execute", lambda state: _execute_node(state, model))
    graph.set_entry_point("plan")
    graph.add_edge("plan", "execute")
    graph.add_conditional_edges("execute", _should_continue_after_execute)

    return graph.compile()
