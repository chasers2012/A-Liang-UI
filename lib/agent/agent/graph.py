"""LangGraph workflow: ideate -> pseudocode -> codegen -> dry-run -> Alphalens -> report."""

from __future__ import annotations

from functools import partial
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from agent.llm import message_text
from agent.prompts import (
    DEFAULT_IDEATE_USER_TOPIC,
    SYSTEM_CODEGEN,
    SYSTEM_IDEATE,
    SYSTEM_PSEUDOCODE,
    codegen_human_message,
    ideate_human_message,
    pseudocode_human_message,
)
from agent.state import (
    DEFAULT_DRY_RUN_END_DATE,
    DEFAULT_DRY_RUN_START_DATE,
    DEFAULT_EVAL_END_DATE,
    DEFAULT_EVAL_START_DATE,
    DEFAULT_FACTOR_DIGGING_EXECUTION,
    DEFAULT_QUANTILES,
    FactorDiggingState,
)
from agent.tools import (
    format_fields_csv,
    list_factor_dependency_fields,
    run_alphalens_evaluation,
    run_factor_dry_run,
)

__all__ = ["build_factor_digging_graph"]

_MAX_REPAIR_AFTER_FAILURE = 3


def _route_after_validate(state: FactorDiggingState) -> str:
    if state.get("dry_run_ok"):
        return "evaluate"
    if (state.get("repair_count") or 0) < _MAX_REPAIR_AFTER_FAILURE:
        return "regenerate"
    return "finalize"


def _ideate_messages(available_fields_csv: str, user_topic: str) -> list[BaseMessage]:
    return [
        SystemMessage(content=SYSTEM_IDEATE),
        HumanMessage(content=ideate_human_message(available_fields_csv, user_topic)),
    ]


def _pseudocode_messages(available_fields_csv: str, research_idea: str) -> list[BaseMessage]:
    return [
        SystemMessage(content=SYSTEM_PSEUDOCODE),
        HumanMessage(content=pseudocode_human_message(available_fields_csv, research_idea)),
    ]


def _codegen_messages(
    dependency_fields_csv: str,
    research_idea: str,
    pseudocode: str,
    previous_dry_run_error: str | None,
    repair_attempt_number: int,
) -> list[BaseMessage]:
    human = codegen_human_message(
        dependency_fields_csv,
        research_idea,
        pseudocode,
        previous_dry_run_error,
        repair_attempt_number,
    )
    return [SystemMessage(content=SYSTEM_CODEGEN), HumanMessage(content=human)]


def _fields_for_state(state: FactorDiggingState) -> list[str]:
    return state.get("available_fields") or list_factor_dependency_fields()


def _node_init_context(state: FactorDiggingState) -> dict[str, Any]:
    out: dict[str, Any] = {
        "available_fields": list_factor_dependency_fields(),
        "repair_count": 0,
        "dry_run_ok": False,
    }
    for key, default in DEFAULT_FACTOR_DIGGING_EXECUTION.items():
        if key not in state:
            out[key] = default
    return out


def _node_ideate(llm: BaseChatModel, state: FactorDiggingState) -> dict[str, Any]:
    fields_txt = format_fields_csv(_fields_for_state(state))
    user = state.get("user_prompt", "").strip() or DEFAULT_IDEATE_USER_TOPIC
    idea = message_text(llm.invoke(_ideate_messages(fields_txt, user))).strip()
    return {"research_idea": idea}


def _node_generate_pseudocode(llm: BaseChatModel, state: FactorDiggingState) -> dict[str, Any]:
    fields_txt = format_fields_csv(_fields_for_state(state))
    idea = (state.get("research_idea") or "").strip()
    pseudo = message_text(llm.invoke(_pseudocode_messages(fields_txt, idea))).strip()
    return {"pseudocode": pseudo}


def _node_generate_code(llm: BaseChatModel, state: FactorDiggingState) -> dict[str, Any]:
    fields = _fields_for_state(state)
    fields_txt = ", ".join(fields)
    idea = state.get("research_idea", "")
    pseudo = (state.get("pseudocode") or "").strip()
    prev_err = state.get("dry_run_error")
    prev_repair = state.get("repair_count", 0)
    repair = prev_repair + 1 if prev_err else prev_repair
    src = message_text(
        llm.invoke(_codegen_messages(fields_txt, idea, pseudo, prev_err, repair))
    ).strip()
    return {"factor_source": src, "dry_run_error": None, "repair_count": repair}


def _node_validate_dry_run(state: FactorDiggingState) -> dict[str, Any]:
    out = run_factor_dry_run(
        state.get("factor_source") or "",
        dry_run_start_date=state.get("dry_run_start_date", DEFAULT_DRY_RUN_START_DATE),
        dry_run_end_date=state.get("dry_run_end_date", DEFAULT_DRY_RUN_END_DATE),
        stock_codes=state.get("stock_codes"),
    )
    return {
        "dry_run_ok": out["dry_run_ok"],
        "dry_run_error": out.get("dry_run_error"),
        "factor_class_name": out.get("factor_class_name", ""),
    }


def _node_evaluate_alphalens(state: FactorDiggingState) -> dict[str, Any]:
    if not state.get("dry_run_ok"):
        return {"evaluation_summary": "", "evaluation_error": "跳过评价：校验未通过"}
    return run_alphalens_evaluation(
        state.get("factor_source") or "",
        skip_alphalens_evaluation=state.get("skip_alphalens_evaluation", False),
        eval_start_date=state.get("eval_start_date", DEFAULT_EVAL_START_DATE),
        eval_end_date=state.get("eval_end_date", DEFAULT_EVAL_END_DATE),
        stock_codes=state.get("stock_codes"),
        quantiles=int(state.get("quantiles", DEFAULT_QUANTILES)),
    )


def _node_finalize(state: FactorDiggingState) -> dict[str, Any]:
    parts = [
        "## 因子挖掘结果\n",
        f"**思路**: {state.get('research_idea', '')}\n",
    ]
    if state.get("pseudocode"):
        parts.append(f"**伪代码**:\n```\n{state['pseudocode']}\n```\n")
    if state.get("dry_run_ok"):
        parts.append(f"**校验**: 通过（类名 {state.get('factor_class_name', '')}）\n")
    else:
        parts.append(f"**校验**: 失败\n{state.get('dry_run_error', '')}\n")
    if state.get("evaluation_summary"):
        parts.append(f"**评价**: {state['evaluation_summary']}\n")
    if state.get("evaluation_error"):
        parts.append(f"**评价错误**: {state['evaluation_error']}\n")
    if state.get("factor_source"):
        parts.append("\n### 生成的代码\n```python\n" + state["factor_source"] + "\n```\n")
    return {"final_report": "\n".join(parts)}


def build_factor_digging_graph() -> CompiledStateGraph:
    llm = init_chat_model("ollama:qwen3.5:9b")
    g: StateGraph = StateGraph(FactorDiggingState)
    g.add_node("init_context", _node_init_context)
    g.add_node("ideate", partial(_node_ideate, llm))
    g.add_node("generate_pseudocode", partial(_node_generate_pseudocode, llm))
    g.add_node("generate_code", partial(_node_generate_code, llm))
    g.add_node("validate", _node_validate_dry_run)
    g.add_node("evaluate", _node_evaluate_alphalens)
    g.add_node("finalize", _node_finalize)

    g.add_edge(START, "init_context")
    g.add_edge("init_context", "ideate")
    g.add_edge("ideate", "generate_pseudocode")
    g.add_edge("generate_pseudocode", "generate_code")
    g.add_edge("generate_code", "validate")
    g.add_conditional_edges(
        "validate",
        _route_after_validate,
        {"evaluate": "evaluate", "regenerate": "generate_code", "finalize": "finalize"},
    )
    g.add_edge("evaluate", "finalize")
    g.add_edge("finalize", END)
    return g.compile()
