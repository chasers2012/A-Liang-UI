from __future__ import annotations

import json
from typing import Any

from app.tool.controller import ToolController
from langchain.agents import AgentState, create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph


class PlanExecuteState(AgentState[Any], total=False):
    plan: list[str]
    current_step: int
    completed_steps: list[str]


def _extract_text(message: BaseMessage | None) -> str:
    if not isinstance(message, AIMessage):
        return ""
    content = message.content
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(part for part in parts if part.strip())
    return ""


def _parse_plan(text: str) -> list[str]:
    if text.strip() == "完成":
        return []
    steps: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        while line and line[0] in "-•*0123456789.、)（( ":
            line = line[1:].lstrip()
        if line:
            steps.append(line)
    return steps


def _plan_node(state: PlanExecuteState, model: str | BaseChatModel) -> PlanExecuteState:
    tool_block = (
        "\n".join(f"- {name}" for name in ToolController().list_tool_names()) or "- 无可用工具"
    )
    planner = create_agent(
        model=model,
        tools=[],
        system_prompt=(
            "你是一个 planning agent。你的职责是分析用户目标并生成一个简洁、可执行的计划。"
            "\n要求："
            "\n1. 只输出计划，不要执行。"
            "\n2. 每个步骤尽量独立、原子化。"
            "\n3. 如果需要调用工具，优先把工具调用安排到相应步骤中。"
            '\n4. 返回一个json数组，每个元素都是一个纯文本描述的步骤。形如：["步骤1","步骤2"]'
            f"\n\n可用工具：\n{tool_block}"
        ),
    )
    messages = state.get("messages", [])
    try:
        result = planner.invoke({"messages": messages})
        plan_text = _extract_text(
            result.get("messages", [])[-1]
            if isinstance(result, dict) and result.get("messages")
            else None
        )
        plan = json.loads(plan_text)
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
