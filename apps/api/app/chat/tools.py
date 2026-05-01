from __future__ import annotations

import json
import operator
from typing import Annotated, Any

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.constants import Send
from langgraph.graph import END, StateGraph
from typing_extensions import TypedDict

from app.chat.controller import build_chat_model
from app.tool.models import ToolAuthorization
from app.tool.safe_tool import safe_tool


class DimensionResult(TypedDict):
    dimension: str
    known: str
    unknown: str
    criticality: str
    inference: str


class W1H6Analysis(TypedDict):
    dimensions: list[DimensionResult]


class Conclusion(TypedDict):
    system_intent: str
    user_role: str
    core_objective: str
    execution_scope: str
    blockers: list[str]
    confidence: str
    recommended_action: str


class GraphState(TypedDict):
    instruction: str
    tool_context: str
    dimension_results: Annotated[list[DimensionResult], operator.add]
    conclusion: Conclusion


class DimensionState(TypedDict):
    instruction: str
    tool_context: str
    dimension: str
    dimension_question: str


DIMENSIONS = [
    {
        "dimension": "Who",
        "dimension_question": "谁提出了这个需求？谁来执行？最终结果给谁使用或查看？涉及哪些隐性角色？",
    },
    {
        "dimension": "What",
        "dimension_question": "真正需要交付什么？边界在哪里？显性需求背后的隐性期望是什么？",
    },
    {
        "dimension": "Why",
        "dimension_question": "做这件事的根本目的是什么？背后的业务或目标是什么？成功标准是什么？",
    },
    {
        "dimension": "When",
        "dimension_question": "有哪些时间约束？任务的时效性要求是什么？是一次性还是持续性需求？",
    },
    {
        "dimension": "Where",
        "dimension_question": "在什么平台、场景或环境下使用？有哪些上下文约束？",
    },
    {
        "dimension": "How",
        "dimension_question": "有哪些方法偏好、资源约束或质量标准？期望的交付方式是什么？",
    },
]

DIMENSION_ORDER = [item["dimension"] for item in DIMENSIONS]

DIMENSION_SYSTEM = """\
你是一个需求分析专家，负责从用户指令和系统工具上下文中分析单个 5W1H 维度。

分析规则：
- 只分析被指定的维度，不涉及其他维度
- 区分"指令中明确提到的"和"需要推断的"
- 利用 tool_context 推断系统能力对该维度的影响
- criticality 评估该维度对当前任务的关键程度：
    high   = 缺失会导致执行方向错误
    medium = 缺失会影响执行质量
    low    = 缺失不影响主要执行

以 JSON 格式返回，结构严格如下，不要包含其他内容：
{
  "dimension": "<维度名>",
  "known": "<从指令中可以确认的信息>",
  "unknown": "<缺失或不确定的信息，若无则填 '无'>",
  "criticality": "<high|medium|low>",
  "inference": "<根据 tool_context 对缺失信息的推断，若无法推断则填 '无法推断'>"
}
"""

SYNTHESIS_SYSTEM = """\
你是一个需求综合分析专家。你将收到对同一用户指令进行的 6 个维度（5W1H）分析结果，
以及原始指令和系统工具上下文，需要综合输出结构化结论。

输出规则：
- system_intent：根据 tool_context 推断操作者/系统的设计意图
- user_role：用户在该系统中被预设的角色
- core_objective：剥离手段后，用户真正想达成的目标（一句话）
- execution_scope：当前工具能力范围内可自主完成的部分
- blockers：列出阻碍执行的关键信息缺口或能力缺口（仅列 criticality=high 的未知项）
- confidence：综合所有维度的完整性评估
    high   = 可直接执行
    medium = 可执行但有风险，建议先澄清 blockers
    low    = 核心信息缺失，需要先澄清再执行
- recommended_action：
    proceed   = 信息足够，直接执行
    clarify   = 有关键缺口，先向用户澄清
    escalate  = 超出工具能力范围，需要人工介入

以 JSON 格式返回，结构严格如下：
{
  "system_intent": "...",
  "user_role": "...",
  "core_objective": "...",
  "execution_scope": "...",
  "blockers": ["...", "..."],
  "confidence": "high|medium|low",
  "recommended_action": "proceed|clarify|escalate"
}
"""


def _extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            if (
                isinstance(item, dict)
                and item.get("type") == "text"
                and isinstance(item.get("text"), str)
            ):
                parts.append(item["text"])
        return "".join(parts)
    return str(content)


def _parse_json_response(raw_content: Any) -> dict[str, Any]:
    raw = _extract_text_content(raw_content).strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    if raw.startswith("json"):
        raw = raw[4:].strip()
    return json.loads(raw)


def _build_tool_context() -> str:
    # Reuse tools API payload so context reflects the same view as external interface.
    from app.tool.api import list_tools

    tools = list_tools()
    if not tools:
        return "可用工具：无"

    lines = ["可用工具："]
    for item in tools:
        tool_id = str(item.get("id", "")).strip() or "unknown"
        authorization = str(item.get("authorization", "")).strip() or "unknown"
        category = str(item.get("category", "")).strip() or "未分类"
        loaded = bool(item.get("loaded", False))
        description = str(item.get("description", "")).strip() or "无描述"
        lines.append(
            f"- {tool_id} [{category}] ({authorization}, loaded={str(loaded).lower()}): {description}"
        )
    return "\n".join(lines)


def analyze_dimension(state: DimensionState) -> dict[str, Any]:
    llm = build_chat_model()
    prompt = f"""\
## 待分析维度
{state["dimension"]}：{state["dimension_question"]}

## 用户指令
{state["instruction"]}

## 系统工具与功能上下文
{state["tool_context"]}
"""
    response = llm.invoke(
        [SystemMessage(content=DIMENSION_SYSTEM), HumanMessage(content=prompt)],
        config={"metadata": {"silent_stream": True}},
    )
    result: DimensionResult = _parse_json_response(response.content)  # type: ignore[assignment]
    return {"dimension_results": [result]}


def synthesize(state: GraphState) -> dict[str, Any]:
    llm = build_chat_model()
    dimensions_text = "\n\n".join(
        f"### {r['dimension']}\n"
        f"已知：{r['known']}\n"
        f"未知：{r['unknown']}\n"
        f"关键性：{r['criticality']}\n"
        f"推断：{r['inference']}"
        for r in state["dimension_results"]
    )
    prompt = f"""\
## 用户指令
{state["instruction"]}

## 系统工具与功能上下文
{state["tool_context"]}

## 各维度分析结果
{dimensions_text}
"""
    response = llm.invoke(
        [SystemMessage(content=SYNTHESIS_SYSTEM), HumanMessage(content=prompt)],
        config={"metadata": {"silent_stream": True}},
    )
    conclusion: Conclusion = _parse_json_response(response.content)  # type: ignore[assignment]
    return {"conclusion": conclusion}


def fan_out(state: GraphState) -> list[Send]:
    return [
        Send(
            "analyze_dimension",
            {
                "instruction": state["instruction"],
                "tool_context": state["tool_context"],
                "dimension": dim["dimension"],
                "dimension_question": dim["dimension_question"],
            },
        )
        for dim in DIMENSIONS
    ]


def build_graph() -> Any:
    graph = StateGraph(GraphState)
    graph.add_node("analyze_dimension", analyze_dimension)
    graph.add_node("synthesize", synthesize)
    graph.set_conditional_entry_point(fan_out)
    graph.add_edge("analyze_dimension", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()


graph = build_graph()


@safe_tool("analyze_5w1h_requirement", parse_docstring=True)
def analyze_5w1h_requirement(instruction: str) -> dict[str, Any]:
    """
    对用户需求执行 5W1H 结构化分析并给出综合结论。

    该工具会并行分析 Who/What/Why/When/Where/How 六个维度，输出每个维度的已知、未知、关键性和基于工具上下文的推断，
    然后给出系统意图、用户角色、核心目标、执行范围、阻塞项、置信度和建议动作。

    Args:
        instruction: 用户需求或指令原文。

    Returns:
        包含 `analysis`（六维分析）和 `conclusion`（综合结论）的结构化结果。
    """
    tool_context = _build_tool_context()
    result = graph.invoke(
        {
            "instruction": instruction,
            "tool_context": tool_context,
            "dimension_results": [],
        }
    )
    ordered_dimensions = sorted(
        result["dimension_results"],
        key=lambda item: (
            DIMENSION_ORDER.index(item.get("dimension", ""))
            if item.get("dimension", "") in DIMENSION_ORDER
            else len(DIMENSION_ORDER)
        ),
    )
    analysis: W1H6Analysis = {"dimensions": ordered_dimensions}
    return {
        "analysis": analysis,
        "conclusion": result["conclusion"],
    }


TOOLS = {
    "chat.analyze_5w1h_requirement": (
        analyze_5w1h_requirement,
        ToolAuthorization.allowed,
    ),
}
