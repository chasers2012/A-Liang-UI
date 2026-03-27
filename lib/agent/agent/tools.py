"""LangChain tools: LLM ideation/codegen, dependency fields, dry-run, Alphalens."""

from __future__ import annotations

import json
import os
import traceback
from typing import Any

import pandas as pd
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from agent.codegen import load_factor_class
from agent.context import get_dependency_resolver, list_registered_dependency_fields
from agent.llm import build_chat_llm, message_text, stream_llm
from agent.prompts import (
    SYSTEM_CODEGEN,
    SYSTEM_IDEATE,
    SYSTEM_PSEUDOCODE,
    codegen_human_message,
    ideate_human_message,
    pseudocode_human_message,
)

__all__ = [
    "FACTOR_EXECUTION_TOOLS",
    "FACTOR_LLM_TOOLS",
    "describe_factor_dependency_fields",
    "draft_factor_pseudocode",
    "dry_run_factor_source",
    "evaluate_factor_with_alphalens",
    "format_fields_csv",
    "generate_factor_python_source",
    "ideate_factor_research",
    "list_factor_dependency_fields",
    "run_alphalens_evaluation",
    "run_factor_dry_run",
]


def _stock_codes_from_env() -> list[str] | None:
    raw = os.environ.get("FACTOR_AGENT_STOCK_CODES", "")
    if not raw.strip():
        return None
    codes = [c.strip() for c in raw.split(",") if c.strip()]
    return codes or None


def _env_skip_alphalens() -> bool:
    v = os.environ.get("FACTOR_AGENT_SKIP_EVAL", "").strip().lower()
    return v in {"1", "true", "yes"}


def list_factor_dependency_fields() -> list[str]:
    """Registered dependency field names (for graph state)."""
    return list_registered_dependency_fields()


def format_fields_csv(fields: list[str], *, max_show: int = 80) -> str:
    return ", ".join(fields[:max_show]) + ("…" if len(fields) > max_show else "")


@tool
def ideate_factor_research(available_fields_csv: str, user_topic: str) -> str:
    """Draft a factor research idea from dependency fields (CSV) and user topic."""
    llm = build_chat_llm()
    msg = stream_llm(
        llm,
        [
            SystemMessage(content=SYSTEM_IDEATE),
            HumanMessage(content=ideate_human_message(available_fields_csv, user_topic)),
        ],
        stage="ideate",
    )
    return message_text(msg).strip()


@tool
def draft_factor_pseudocode(available_fields_csv: str, research_idea: str) -> str:
    """Pseudocode for a factor from fields summary and research idea."""
    llm = build_chat_llm()
    msg = stream_llm(
        llm,
        [
            SystemMessage(content=SYSTEM_PSEUDOCODE),
            HumanMessage(content=pseudocode_human_message(available_fields_csv, research_idea)),
        ],
        stage="pseudocode",
    )
    return message_text(msg).strip()


@tool
def generate_factor_python_source(
    dependency_fields_csv: str,
    research_idea: str,
    pseudocode: str,
    previous_dry_run_error: str | None,
    repair_attempt_number: int,
) -> str:
    """Python source for a Factor subclass; optional dry-run error for repair."""
    llm = build_chat_llm()
    human = codegen_human_message(
        dependency_fields_csv,
        research_idea,
        pseudocode,
        previous_dry_run_error,
        repair_attempt_number,
    )
    msg = stream_llm(
        llm,
        [SystemMessage(content=SYSTEM_CODEGEN), HumanMessage(content=human)],
        stage="codegen",
    )
    return message_text(msg).strip()


FACTOR_LLM_TOOLS = [
    ideate_factor_research,
    draft_factor_pseudocode,
    generate_factor_python_source,
]


@tool
def describe_factor_dependency_fields() -> str:
    """Comma-separated dependency field names for Factor implementations (truncated)."""
    return format_fields_csv(list_factor_dependency_fields())


def run_factor_dry_run(factor_source: str) -> dict[str, Any]:
    """Load factor source and run ``calculate()``; dict for graph state updates."""
    if not factor_source:
        return {"dry_run_ok": False, "dry_run_error": "未生成因子代码"}

    resolver = get_dependency_resolver()
    if resolver is None:
        return {
            "dry_run_ok": False,
            "dry_run_error": (
                "未配置 DependencyResolver：请在运行前调用 "
                "agent.context.set_dependency_resolver(resolver)，"
                "或在 run_factor_digging(..., dependency_resolver=...) 传入。"
            ),
        }

    start = os.environ.get("FACTOR_AGENT_START_DATE", "2024-06-01")
    end = os.environ.get("FACTOR_AGENT_END_DATE", "2024-12-31")
    stock_codes = _stock_codes_from_env()

    try:
        cls, class_name = load_factor_class(factor_source)
        inst = cls(dependency_resolver=resolver)
        out = inst.calculate(start_date=start, end_date=end, stock_codes=stock_codes)
        if out.empty:
            return {
                "dry_run_ok": False,
                "dry_run_error": "calculate 结果为空，请检查窗口、依赖字段与 calc 逻辑",
                "factor_class_name": class_name,
            }
        if not isinstance(out.index, pd.MultiIndex):
            return {
                "dry_run_ok": False,
                "dry_run_error": "calc 输出索引必须是 MultiIndex",
                "factor_class_name": class_name,
            }
        return {"dry_run_ok": True, "dry_run_error": None, "factor_class_name": class_name}
    except Exception as e:
        return {"dry_run_ok": False, "dry_run_error": f"{e}\n{traceback.format_exc()}"}


@tool
def dry_run_factor_source(factor_source: str) -> str:
    """Dry-run factor source: JSON with dry_run_ok, dry_run_error, factor_class_name."""
    return json.dumps(run_factor_dry_run(factor_source), ensure_ascii=False)


def run_alphalens_evaluation(factor_source: str) -> dict[str, Any]:
    """Run Alphalens evaluation for the given factor source."""
    if _env_skip_alphalens():
        return {
            "evaluation_summary": "已根据 FACTOR_AGENT_SKIP_EVAL 跳过 Alphalens 评价。",
            "evaluation_error": None,
        }

    resolver = get_dependency_resolver()
    if resolver is None:
        return {
            "evaluation_summary": "",
            "evaluation_error": "跳过评价：未配置 DependencyResolver",
        }

    start = os.environ.get(
        "FACTOR_AGENT_EVAL_START",
        os.environ.get("FACTOR_AGENT_START_DATE", "2023-01-01"),
    )
    end = os.environ.get(
        "FACTOR_AGENT_EVAL_END",
        os.environ.get("FACTOR_AGENT_END_DATE", "2024-12-31"),
    )
    stock_codes = _stock_codes_from_env()
    quantiles = int(os.environ.get("FACTOR_AGENT_QUANTILES", "5"))

    try:
        import matplotlib

        matplotlib.use("Agg")

        from evaluate import AlphalensFactorEvaluator

        cls, _ = load_factor_class(factor_source)
        factor = cls(dependency_resolver=resolver)
        ev = AlphalensFactorEvaluator(
            factor,
            start_date=start,
            end_date=end,
            stock_codes=stock_codes,
            long_short=True,
        )
        ev.evaluate_factor(quantiles=quantiles, periods=(1, 5, 10, 20))
        name = factor.name
        summary = (
            f"因子 {name} 已完成 Alphalens 评价（{start}～{end}，quantiles={quantiles}）。"
            " 指标由 evaluate.AlphalensFactorEvaluator 在内存中计算（未写 tear sheet 文件）。"
        )
        return {"evaluation_summary": summary, "evaluation_error": None}
    except Exception as e:
        return {"evaluation_summary": "", "evaluation_error": f"{e}\n{traceback.format_exc()}"}


@tool
def evaluate_factor_with_alphalens(factor_source: str) -> str:
    """Alphalens evaluation: JSON with evaluation_summary and evaluation_error."""
    return json.dumps(run_alphalens_evaluation(factor_source), ensure_ascii=False)


FACTOR_EXECUTION_TOOLS = [
    describe_factor_dependency_fields,
    dry_run_factor_source,
    evaluate_factor_with_alphalens,
]
