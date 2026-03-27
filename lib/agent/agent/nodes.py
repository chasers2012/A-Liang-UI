"""LangGraph nodes for the factor-digging workflow."""

from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool

from agent.prompts import DEFAULT_IDEATE_USER_TOPIC
from agent.state import FactorDiggingState
from agent.tools import (
    draft_factor_pseudocode,
    format_fields_csv,
    generate_factor_python_source,
    ideate_factor_research,
    list_factor_dependency_fields,
    run_alphalens_evaluation,
    run_factor_dry_run,
)

__all__ = [
    "node_evaluate_alphalens",
    "node_finalize",
    "node_generate_code",
    "node_generate_pseudocode",
    "node_ideate",
    "node_init_context",
    "node_validate_dry_run",
]


def _invoke_str(t: BaseTool, args: dict[str, Any]) -> str:
    out = t.invoke(args)
    return out if isinstance(out, str) else str(out)


def _fields_for_state(state: FactorDiggingState) -> list[str]:
    return state.get("available_fields") or list_factor_dependency_fields()


def node_init_context(state: FactorDiggingState) -> dict[str, Any]:
    return {
        "available_fields": list_factor_dependency_fields(),
        "repair_count": 0,
        "dry_run_ok": False,
    }


def node_ideate(state: FactorDiggingState) -> dict[str, Any]:
    fields_txt = format_fields_csv(_fields_for_state(state))
    user = state.get("user_prompt", "").strip() or DEFAULT_IDEATE_USER_TOPIC
    idea = _invoke_str(
        ideate_factor_research,
        {"available_fields_csv": fields_txt, "user_topic": user},
    )
    return {"research_idea": idea}


def node_generate_pseudocode(state: FactorDiggingState) -> dict[str, Any]:
    fields_txt = format_fields_csv(_fields_for_state(state))
    idea = (state.get("research_idea") or "").strip()
    pseudo = _invoke_str(
        draft_factor_pseudocode,
        {"available_fields_csv": fields_txt, "research_idea": idea},
    )
    return {"pseudocode": pseudo}


def node_generate_code(state: FactorDiggingState) -> dict[str, Any]:
    fields = _fields_for_state(state)
    fields_txt = ", ".join(fields)
    idea = state.get("research_idea", "")
    pseudo = (state.get("pseudocode") or "").strip()
    prev_err = state.get("dry_run_error")
    prev_repair = state.get("repair_count", 0)
    repair = prev_repair + 1 if prev_err else prev_repair

    src = _invoke_str(
        generate_factor_python_source,
        {
            "dependency_fields_csv": fields_txt,
            "research_idea": idea,
            "pseudocode": pseudo,
            "previous_dry_run_error": prev_err,
            "repair_attempt_number": repair,
        },
    )
    return {"factor_source": src, "dry_run_error": None, "repair_count": repair}


def node_validate_dry_run(state: FactorDiggingState) -> dict[str, Any]:
    out = run_factor_dry_run(state.get("factor_source") or "")
    return {
        "dry_run_ok": out["dry_run_ok"],
        "dry_run_error": out.get("dry_run_error"),
        "factor_class_name": out.get("factor_class_name", ""),
    }


def node_evaluate_alphalens(state: FactorDiggingState) -> dict[str, Any]:
    if not state.get("dry_run_ok"):
        return {"evaluation_summary": "", "evaluation_error": "跳过评价：校验未通过"}
    return run_alphalens_evaluation(state.get("factor_source") or "")


def node_finalize(state: FactorDiggingState) -> dict[str, Any]:
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
