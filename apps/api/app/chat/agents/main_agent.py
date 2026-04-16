from __future__ import annotations

from typing import Any

from app.tool.controller import ToolController
from langchain.agents import AgentState, create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel, Field


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


def _plan_node(state: PlanExecuteState, model: str | BaseChatModel) -> PlanExecuteState:
    tool_block = (
        "\n".join(f"- {name}" for name in ToolController().list_tool_names()) or "- 无可用工具"
    )
    messages = state.get("messages", [])
    try:
        system_prompt = (
            "你是一个 planning agent。你的职责是分析用户目标并生成一个简洁、可执行的计划。\n"
            "要求：\n"
            "1. 只输出计划，不要执行。\n"
            "2. 每个步骤尽量独立、原子化。\n"
            "3. 如果需要调用工具，优先把工具调用安排到相应步骤中。\n"
            "4. 按结构化输出生成：plan 为 list[str]，每个元素是纯文本步骤描述。\n"
            f"\n可用工具：\n{tool_block}"
        )
        structured_planner = model.with_structured_output(PlannerPlanOutput)
        structured_result = structured_planner.invoke(
            [SystemMessage(content=system_prompt), *messages]
        )
        plan = structured_result.plan
    except Exception as e:
        print(e)
        plan = None

    if not plan:
        plan = ["直接回答用户请求并给出最终结论。"]
    return {
        "messages": messages,
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
        next_messages = messages + result.get("messages", [])
    except Exception as e:
        print(e)
        next_messages = [*messages, SystemMessage(content=f"执行失败: {e}")]

    completed_steps.append(step)
    return {
        "messages": next_messages,
        "plan": plan,
        "current_step": current_step + 1,
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
